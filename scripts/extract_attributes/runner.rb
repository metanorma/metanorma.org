# frozen_string_literal: true

require "date"
require "yaml"
require "fileutils"

module ExtractAttributes
  # Orchestrates one full extraction: parse → segment → build entries →
  # merge duplicates → validator amendments → cross-check → write YAML.
  class Runner
    def initialize(out: $stdout, output_dir: OUTPUT_DIR)
      @out = out
      @output_dir = output_dir
      @report = Report.new
    end

    attr_reader :report

    def run(keys, pages: PAGES, amendments: VALIDATOR_AMENDMENTS)
      FileUtils.mkdir_p(@output_dir)
      keys.each do |key|
        run_one(key, pages.fetch(key) { raise "unknown flavor #{key.inspect}" },
                amendments.fetch(key, {}))
      end
      File.write(File.join(@output_dir, "extraction-report.txt"), @report.render)
      @out.puts "report written to #{File.join(@output_dir, 'extraction-report.txt')}"
    end

    private

    def run_one(key, config, amendments)
      page = SourcePage.load(config[:source])
      facts = @report[key]
      facts[:prose_target] = config[:companion] ? "(companion: #{config[:companion]})" : "(manifest sections:)"

      seg = Segmenter.new(page.body_lines)
      facts[:dropped_duplicate_terms] = seg.dropped_duplicate_terms
      facts[:comments_dropped] += seg.dropped_comments

      # An entry is "last in section" when the next entry/section event is
      # a section heading (or the page ends): its trailing prose belongs to
      # the section, not the entry.
      last_flags = {}
      seg.events.each_with_index do |ev, i|
        next unless ev.type == :entry

        nxt = seg.events[(i + 1)..]&.find { |e| e.type == :entry || e.type == :section }
        last_flags[i] = nxt.nil? || nxt.type == :section
      end

      trail = []
      intro = nil
      raw_entries = [] # [{key, entry, line_no}]
      prose_events = [] # [{where, lines}]

      seg.events.each_with_index do |ev, i|
        case ev.type
        when :section
          trail[ev.level - 1] = ev.title
          trail = trail[0, ev.level]
        when :intro_prose
          intro = clean_prose_block(ev.lines)
        when :prose
          record_prose(facts, prose_events, trail, ev.lines)
        when :entry
          category = trail[0]
          subsection = trail[1..]&.join(" / ")
          subsection = nil if subsection.to_s.empty?
          builder = EntryBuilder.new(ev, category: category, subsection: subsection,
                                          gem_name: config[:gem],
                                          last_in_section: last_flags[i],
                                          log: ->(m) { facts[:notes] << m })
          result = builder.build
          result.stats.each { |k, v| facts[k] += v if facts.key?(k) }
          key_name, entry = result.entry.first
          raw_entries << [key_name, entry, ev.line_no]
          result.satellites.each do |sat|
            sat_name, sat_entry = sat.first
            raw_entries << [sat_name, sat_entry, ev.line_no]
            facts[:satellites] += 1
          end
          result.spillover.each { |block| facts[:spillover] << block }
          record_spillover(facts, prose_events, trail, result.spillover) if config[:companion].nil?
        end
      end

      merged = merge_duplicates(raw_entries, facts)
      apply_amendments(merged, facts, amendments)
      crosscheck(page, merged, facts)
      collect_stats(merged, facts)
      write_manifest(key, config, intro, merged, prose_events)
      @out.puts "#{key}: #{merged.size} attributes written to attributes/#{key}.yaml"
    end

    def record_prose(facts, prose_events, trail, lines)
      text = clean_prose_block(lines)
      return if text.empty?

      category = trail[0]
      subsection = trail[1..]&.join(" / ")
      subsection = nil if subsection.to_s.empty?
      where = trail.empty? ? "(before first section)" : trail.join(" / ")
      prose_events << { category: category, subsection: subsection,
                        where: where, lines: lines }
      facts[:prose_blocks] << { where: where, text: text }
      facts[:prose_lines] += lines.size
    end

    # For standoc, spillover example blocks join the section prose (they
    # have no companion page).
    def record_spillover(_facts, prose_events, trail, blocks)
      return if blocks.empty?

      category = trail[0]
      subsection = trail[1..]&.join(" / ")
      subsection = nil if subsection.to_s.empty?
      where = trail.empty? ? "(before first section)" : trail.join(" / ")
      blocks.each do |block|
        prose_events << { category: category, subsection: subsection,
                          where: where, lines: block.split("\n") }
      end
    end

    def clean_prose_block(lines)
      lines = lines.reject { |l| l.strip == "+" }
      text = lines.join("\n").gsub(/\n{3,}/, "\n\n").strip
      text
    end

    # Later occurrences merge into the first: descriptions concatenate,
    # values union by name, first-wins for scalar fields.
    def merge_duplicates(raw_entries, facts)
      order = []
      index = {}
      raw_entries.each do |name, entry, line_no|
        if (existing = index[name])
          facts[:merged] << merge_one(name, existing, entry, line_no)
        else
          index[name] = entry
          order << name
        end
      end
      order.map { |name| [name, index[name]] }
    end

    def merge_one(name, first, second, line_no)
      notes = []
      %w[description example].each do |field|
        next unless second[field]

        if first[field].nil?
          first[field] = second[field]
        elsif first[field] != second[field]
          first[field] = "#{first[field]}\n\n#{second[field]}"
          notes << "#{field} concatenated"
        end
      end
      if second["values"]
        have = (first["values"] ||= []).map { |v| v["name"] }
        second["values"].each do |v|
          unless have.include?(v["name"])
            first["values"] << v
            have << v["name"]
          end
        end
      end
      %w[default required deprecated added_in version_history type].each do |field|
        first[field] = second[field] if first[field].nil? && !second[field].nil?
      end
      if second["category"] != first["category"]
        note = "Also documented under “#{second['category']}”; both descriptions are merged here."
        first["notes"] = [first["notes"], note].compact.join(" ")
        notes << "second occurrence was under “#{second['category']}”"
      end
      "#{name} (second occurrence near line #{line_no}: #{notes.join('; ')})"
    end

    # Validator-review corrections. Amendments merge into extracted
    # entries; an amendment naming an attribute with NO extracted entry
    # creates it (validator-only attributes — e.g. an undocumented doctype
    # whose value set is enforced by the gem but absent from the page).
    # The new entry's category comes from the amendment's optional
    # "category" key, falling back to the manifest's first category.
    # Field-level operations per attribute block:
    #   "add_values"   => [ {name, description?, notes?}, ... ] (union)
    #   "notes_update" => { value-name => note } (per-value notes)
    #   "notes"        => attribute-level note (appended)
    #   "set"          => { field => value } (overwrite fields, e.g. type/default)
    #   "drop"         => [ field, ... ] (remove fields, e.g. required/added_in)
    def apply_amendments(merged, facts, amendments)
      index = merged.to_h
      amendments.each do |name, amend|
        entry = index[name]
        unless entry
          entry = {}
          category = amend["category"] || index.values.first&.dig("category")
          entry["category"] = category if category
          merged << [name, entry]
          index[name] = entry
          facts[:amendments] << "#{name}: entry created from validator amendment (not documented on the source page)"
        end
        if amend["add_values"]
          have = (entry["values"] ||= []).map { |v| v["name"] }
          amend["add_values"].each do |v|
            next if have.include?(v["name"])

            entry["values"] << v
            facts[:amendments] << "#{name}: added value #{v['name']} (#{v['notes'] || 'from gem validation'})"
          end
          entry["type"] = "enum" if entry["type"].nil? || entry["type"] == "string"
        end
        if amend["set"]
          amend["set"].each do |field, value|
            entry[field] = value
            facts[:amendments] << "#{name}: set #{field} = #{value.inspect}"
          end
        end
        if amend["drop"]
          amend["drop"].each do |field|
            next unless entry.key?(field)

            entry.delete(field)
            facts[:amendments] << "#{name}: dropped #{field}"
          end
        end
        if amend["notes_update"]
          values = entry["values"] ||= []
          amend["notes_update"].each do |value_name, note|
            value = values.find { |v| v["name"] == value_name }
            if value
              value["notes"] = [value["notes"], note].compact.join(" ")
            else
              values << { "name" => value_name, "notes" => note }
            end
            facts[:amendments] << "#{name}: noted value #{value_name}"
          end
        end
        next unless amend["notes"]

        entry["notes"] = [entry["notes"], amend["notes"]].compact.join(" ")
        facts[:amendments] << "#{name}: #{amend['notes']}"
      end
    end

    def crosscheck(page, merged, facts)
      extracted_values = {}
      merged.each do |name, entry|
        extracted_values[name] = (entry["values"] || []).map { |v| v["name"] }
      end
      keys = merged.map(&:first)
      facts[:crosscheck] = AstCrosscheck.new(page.document).compare(keys, extracted_values)
    end

    def collect_stats(merged, facts)
      facts[:entries] = merged.count { |_, e| !e["alias_of"] && !e["see"] }
      merged.each do |name, entry|
        facts[:enums] += 1 if entry["type"] == "enum"
        facts[:values] += (entry["values"] || []).size
        facts[:required] << name if entry["required"]
        facts[:defaults] += 1 if entry["default"]
        facts[:deprecated] << name if entry["deprecated"]
        facts[:repeatable] += 1 if entry["repeatable"]
        facts[:anchors] << "#{name}##{entry['anchor']}" if entry["anchor"]
        facts[:recovered] << "#{name} (source term `#{entry['source_term']}`)" if entry["source_term"]
      end
    end

    def write_manifest(key, config, intro, merged, prose_events)
      data = {}
      data["flavor"] = config[:flavor]
      data["label"] = config[:label]
      data["inherits_from"] = config[:inherits_from]
      data["gem"] = config[:gem]
      data["source"] = config[:source]
      data["notes"] = config[:notes] if config[:notes]
      data["description"] = intro if intro && !intro.empty?
      if config[:companion].nil?
        sections = build_sections(prose_events)
        data["sections"] = sections if sections.any?
      end
      data["attributes"] = merged.to_h { |name, entry| [name, entry] }

      header = <<~YAML
        # yaml-language-server: $schema=../schemas/attribute-manifest.schema.yaml
        # Metanorma document attributes — #{config[:label]}
        # Generated by scripts/extract-attributes.rb on #{Date.today}; reviewed against gem validators.
      YAML
      File.write(File.join(@output_dir, "#{key}.yaml"), header + Psych.dump(data, line_width: -1))
    end

    # standoc only: section prose grouped (in first-seen order) by section.
    def build_sections(prose_events)
      order = []
      by_key = {}
      prose_events.each do |ev|
        k = [ev[:category], ev[:subsection]]
        unless by_key[k]
          by_key[k] = { "name" => ev[:category], "subsection" => ev[:subsection], "prose" => [] }
          order << k
        end
        by_key[k]["prose"] << clean_prose_block(ev[:lines])
      end
      order.filter_map do |k|
        s = by_key[k]
        prose = s["prose"].reject(&:empty?).join("\n\n")
        next if prose.empty?

        out = { "name" => s["name"] }
        out["subsection"] = s["subsection"] if s["subsection"]
        out["prose"] = prose
        out
      end
    end
  end
end
