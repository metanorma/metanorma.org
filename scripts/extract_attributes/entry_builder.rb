# frozen_string_literal: true

module ExtractAttributes
  # Builds one manifest entry from a raw entry event (term line + body
  # lines). Also yields alias/see satellite entries for multi-name terms,
  # and spillover section-level example blocks.
  class EntryBuilder
    VALUE_TRIPLE_RE = /\A`([^`:][^`]*)`:::\s*(.*)\z/.freeze
    VALUE_DOUBLE_RE = /\A`([^`:][^`]*)`::\s+(\S.*)\z/.freeze
    BULLET_RE = /\A\*\s+`([^`]+)`\s*:?(.*)\z/.freeze
    VALUES_INTRO_RE = /values?\s+(?:are|allowed)\b|choices\b|possible values/i.freeze
    INLINE_ENUM_RE = /(?:valid|legal|allowed|accepted|possible)\s+values(?:\s+are|\s+is)?\s*:?\s*((?:`[^`]+`(?:\s*\((?:default|default value)\))?(?:\s*,\s*|\s+(?:or|and)\s+|\s*\.\s*$))+)/i.freeze
    COMMENT_RE = /\A\s*\/\//.freeze
    TITLE_LINE_RE = /\A\.([^.].*)\z/.freeze

    Result = Struct.new(:entry, :satellites, :spillover, :stats, keyword_init: true)

    def initialize(event, category:, subsection:, gem_name:, last_in_section: false, log: nil)
      @event = event
      @category = category
      @subsection = subsection
      @gem_name = gem_name
      @last_in_section = last_in_section
      @log = log # callable receiving String notes
      @stats = { value_lines: 0, bullet_values: 0, inline_values: 0,
                 examples: 0, added_in: 0, comments_dropped: 0 }
    end

    def build
      info = TermParser.analyze(@event.term_line)
      raise "unparseable term line: #{@event.term_line.inspect}" unless info

      lines = []
      lines << info[:first_dd_line] unless info[:first_dd_line].to_s.empty?
      lines.concat(@event.body_lines)

      dd_zone, free_zone = split_zones(lines)
      dd_zone, examples = extract_examples(dd_zone)
      dd_kept, dd_values = extract_line_values(dd_zone)
      free_kept, free_values = extract_line_values(free_zone)
      values = dd_values + free_values
      dd_kept, values = extract_bullet_values(dd_kept, info[:key]) if values.empty?
      free_kept, values = extract_bullet_values(free_kept, info[:key]) if values.empty?
      free_prose, spillover = extract_spillover(free_kept)

      description_lines = dd_kept.dup
      if @last_in_section && values.empty?
        # Prose after the last entry of a (sub)section is section-level
        # (typically an epilogue about the attribute family) unless the
        # entry has enum values the prose may still be elaborating.
        trailing = free_prose.join("\n").strip
        spillover << trailing unless trailing.empty?
      else
        description_lines.concat(free_prose)
      end
      description = clean_prose(description_lines)
      description, macros = Inference.extract_added_in(description, @gem_name)
      @stats[:added_in] += macros.size

      values.each { |v| finish_value(v) }
      values = extract_inline_values(description) if values.empty?

      entry = {}
      entry["category"] = @category
      entry["subsection"] = @subsection if @subsection
      entry["type"] = Inference.infer_type(info[:key], description, values)
      if values.any?
        entry["values"] = values.map { |v| v.reject { |k, _| k.start_with?("_") } }
      end
      default = Inference.extract_default(description, values)
      entry["default"] = default if default
      entry["required"] = true if Inference.required?(description)
      entry["repeatable"] = true if TermParser.repeatable?(info[:key])
      entry["deprecated"] = true if Inference.deprecated?(description, info[:deprecated])
      entry["anchor"] = info[:anchor] if info[:anchor] && info[:anchor] != info[:key]
      entry["source_term"] = info[:source_term] if info[:source_term]
      if info[:other_names].any? && !info[:grouped]
        entry["aliases"] = info[:other_names]
      end
      entry["legacy"] = info[:legacy] if info[:legacy].any?
      if macros.any?
        entry["added_in"] = macros.first
        entry["version_history"] = macros[1..] if macros.size > 1
      end
      example_text = render_examples(examples)
      entry["example"] = example_text unless example_text.empty?
      entry["description"] = description unless description.empty?

      satellites = build_satellites(info, entry)
      Result.new(entry: { info[:key] => entry }, satellites: satellites,
                 spillover: spillover, stats: @stats)
    end

    private

    # dd zone = the contiguous first paragraph plus every `+`-continuation
    # chain; free zone = everything after. The first paragraph ends at the
    # first blank line, `+` continuation marker, or fence line.
    def split_zones(lines)
      dd = []
      i = 0
      while i < lines.size && !blank?(lines[i]) && lines[i].strip != "+" &&
            !Fences.fence_marker(lines[i])
        dd << lines[i]
        i += 1
      end
      loop do
        j = i
        j += 1 while j < lines.size && blank?(lines[j])
        break unless j < lines.size && lines[j].strip == "+"

        dd.concat(lines[i...j])
        dd << lines[j]
        j += 1
        open = nil
        while j < lines.size
          line = lines[j]
          if open
            dd << line
            open = nil if Fences.fence_marker(line) == open
          elsif (marker = Fences.fence_marker(line))
            open = marker
            dd << line
          elsif blank?(line)
            break
          else
            dd << line
          end
          j += 1
        end
        i = j
      end
      [dd, lines[i..] || []]
    end

    # Extracts `[example]` blocks (fenced `====` or unfenced) and bare
    # `[source]` continuation blocks. `--` open blocks are transparent for
    # `[example]` but suppress bare-source extraction (a `[source]` inside
    # a note/open block is description content, not an example).
    # Returns [kept_lines, examples].
    def extract_examples(zone)
      kept = []
      examples = []
      open = nil
      i = 0
      while i < zone.size
        line = zone[i]
        marker = Fences.fence_marker(line)
        if open
          if open == "--" && line.strip == "[example]"
            title, content, i = consume_example(zone, i + 1)
            examples << { "title" => title || pop_title(kept),
                          "content" => clean_example(content) }
            @stats[:examples] += 1
            next
          end
          kept << line
          open = nil if marker == open
          i += 1
          next
        end
        if marker
          open = marker
          kept << line
          i += 1
          next
        end
        if line.strip == "[example]"
          title, content, i = consume_example(zone, i + 1)
          examples << { "title" => title || pop_title(kept),
                        "content" => clean_example(content) }
          @stats[:examples] += 1
          next
        end
        if line.strip.match?(/\A\[source[,\]]/) && zone[i + 1]&.strip == "----"
          content = []
          j = i + 2
          while j < zone.size && zone[j].strip != "----"
            content << zone[j]
            j += 1
          end
          examples << { "title" => pop_title(kept), "content" => clean_example(content) }
          @stats[:examples] += 1
          i = j + 1
          next
        end
        kept << line
        i += 1
      end
      [kept, examples]
    end

    def consume_example(zone, start)
      content = []
      title = nil
      j = start
      j += 1 while j < zone.size && zone[j].strip.empty?
      # A .Title line may sit between the [example] marker and the fence.
      if zone[j] && (tm = TITLE_LINE_RE.match(zone[j].strip))
        title = tm[1]
        j += 1
      end
      if zone[j]&.strip == "===="
        j += 1
        while j < zone.size && zone[j].strip != "===="
          content << zone[j]
          j += 1
        end
        j += 1 # closing fence
      else
        while j < zone.size && !zone[j].strip.empty?
          content << zone[j]
          j += 1
        end
      end
      [title, content, j]
    end

    def pop_title(kept)
      last = kept.last
      return nil unless last && TITLE_LINE_RE.match?(last.strip)

      kept.pop.strip[1..]
    end

    def clean_example(lines)
      lines = lines.reject { |l| l.strip.match?(/\A\[source[,\]]/) || l.strip == "----" }
      lines = lines.drop_while { |l| l.strip.empty? }
      lines = lines.reverse.drop_while { |l| l.strip.empty? }.reverse
      lines.join("\n")
    end

    def render_examples(examples)
      examples.map do |e|
        [e["title"], e["content"]].compact.reject(&:empty?).join("\n\n")
      end.reject(&:empty?).join("\n\n")
    end

    # `` `value`::: description `` (and `` `value`:: description ``) lines
    # anywhere in the entry body, outside opaque fences. A value consumes
    # its dd-style sub-content: contiguous lines plus `+`-continuation
    # chains. Blank-separated free blocks stay with the entry flow.
    def extract_line_values(lines)
      kept = []
      values = []
      i = 0
      open = nil
      while i < lines.size
        line = lines[i]
        marker = Fences.fence_marker(line)
        if open
          kept << line
          open = nil if marker == open
          i += 1
          next
        end
        if marker
          open = marker
          kept << line
          i += 1
          next
        end
        unless (m = value_line(line))
          kept << line
          i += 1
          next
        end

        desc = [m[2].to_s]
        i += 1
        # contiguous sub-lines
        while i < lines.size && !blank?(lines[i]) && lines[i].strip != "+" &&
              !Fences.fence_marker(lines[i]) && !value_line(lines[i])
          desc << lines[i]
          i += 1
        end
        # `+`-continuation chains
        loop do
          j = i
          j += 1 while j < lines.size && blank?(lines[j])
          break unless j < lines.size && lines[j].strip == "+"
          break if j + 1 < lines.size && value_line(lines[j + 1])

          desc.concat(lines[i...j])
          desc << lines[j]
          j += 1
          inner_open = nil
          while j < lines.size
            l = lines[j]
            if inner_open
              desc << l
              inner_open = nil if Fences.fence_marker(l) == inner_open
            elsif (mk = Fences.fence_marker(l))
              inner_open = mk
              desc << l
            elsif blank?(l) || l.strip == "+" || value_line(l)
              break
            else
              desc << l
            end
            j += 1
          end
          i = j
        end
        values << { "name" => m[1].strip, "_desc" => desc }
        @stats[:value_lines] += 1
      end
      [kept, values]
    end

    def value_line(line)
      VALUE_TRIPLE_RE.match(line) || VALUE_DOUBLE_RE.match(line)
    end

    # Bullet-list values: a run of `* `token`` bullets introduced by a
    # "values are/allowed/choices" line. Best-effort per the mapping rules.
    def extract_bullet_values(lines, entry_key)
      kept = []
      values = []
      run_active = false
      i = 0
      while i < lines.size
        line = lines[i]
        m = line.nil? ? nil : BULLET_RE.match(line)
        if m && (run_active || values_intro_near?(kept))
          run_active = true
          name, rest = bullet_name(m[1], m[2], entry_key)
          desc = [rest]
          i += 1
          # Continuation lines of this bullet (incl. `**` sub-bullets);
          # a `+` continuation marker belongs to the entry dd, not the value.
          while i < lines.size && !blank?(lines[i]) && !BULLET_RE.match?(lines[i]) &&
                lines[i].strip != "+"
            desc << lines[i]
            i += 1
          end
          values << { "name" => name, "_desc" => desc }
          @stats[:bullet_values] += 1
          next
        end
        run_active = false unless blank?(line)
        kept << line
        i += 1
      end
      [kept, values]
    end

    def values_intro_near?(kept)
      kept.reverse.find { |l| !blank?(l) && l.strip != "+" }.to_s.match?(VALUES_INTRO_RE)
    end

    def bullet_name(token, rest, entry_key)
      if (m = /\A:([A-Za-z0-9-]+):\s*(.+)\z/.match(token)) && m[1] == entry_key
        [m[2], rest]
      else
        [token, rest.sub(/\A:\s*/, "")]
      end
    end

    # "Allowed values: `a`, `b`, and `c`." inline enumerations. Recording
    # only — the prose stays in the description.
    def extract_inline_values(description)
      m = INLINE_ENUM_RE.match(description)
      return [] unless m

      tokens = m[1].scan(/`([^`]+)`/).flatten.uniq
      return [] if tokens.size < 2

      @stats[:inline_values] += tokens.size
      default_token = m[1][/`([^`]+)`\s*\((?:default|default value)\)/, 1]
      tokens.map do |t|
        v = { "name" => t }
        v["_desc"] = []
        v["_inline_default"] = true if t == default_token
        v
      end
    end

    # Free fenced example blocks (`[example]` + `====`, or a bare `====`
    # block) are section-level: they spill to the companion page / sections
    # rather than the entry. Returns [prose_lines, spillover_blocks].
    def extract_spillover(lines)
      prose = []
      spill = []
      i = 0
      while i < lines.size
        line = lines[i]
        if spillover_start?(lines, i)
          block = []
          block << prose.pop if TITLE_LINE_RE.match?(prose.last.to_s)
          while i < lines.size && lines[i] && lines[i].strip != "===="
            block << lines[i]
            i += 1
          end
          if i < lines.size && lines[i]&.strip == "===="
            block << lines[i]
            i += 1
            while i < lines.size && lines[i]
              block << lines[i]
              done = lines[i].strip == "===="
              i += 1
              break if done
            end
          end
          spill << block.join("\n").strip
          next
        end
        prose << line
        i += 1
      end
      [prose, spill]
    end

    def spillover_start?(lines, i)
      stripped = lines[i].to_s.strip
      return false if stripped.empty?
      return true if stripped == "===="
      return false unless stripped == "[example]"

      # Allow an optional .Title line between the marker and the fence.
      j = i + 1
      j += 1 if lines[j] && TITLE_LINE_RE.match?(lines[j].strip)
      lines[j] && lines[j].strip == "===="
    end

    def finish_value(value)
      desc_lines = value.delete("_desc") || []
      inline_default = value.delete("_inline_default")
      desc = clean_prose(desc_lines, value_context: true)
      desc, macros = Inference.extract_added_in(desc, @gem_name)
      value["added_in"] = macros.first if macros.any?
      value["description"] = desc unless desc.empty?
      value["_default"] = true if inline_default || desc.match?(/\((?:default|default value)\)/)
    end

    def clean_prose(lines, value_context: false)
      out = []
      open = nil
      lines.each do |line|
        next if line.nil?

        stripped = line.strip
        if COMMENT_RE.match?(line)
          @stats[:comments_dropped] += 1
          next
        end
        next if value_context && stripped == "[example]"

        marker = Fences.fence_marker(line)
        if open
          unless marker == open && structural_fence?(marker, value_context)
            out << line
          end
          open = nil if marker == open
          next
        end
        if marker
          open = marker
          out << line unless structural_fence?(marker, value_context)
          next
        end
        next if stripped == "+"

        out << line
      end
      out.join("\n").gsub(/\n{3,}/, "\n\n").strip
    end

    # Open-block (--) fences are always structural; example (====) fences
    # are structural when cleaning value descriptions (their content was
    # kept inline). Listing (----) fences and their content stay.
    def structural_fence?(marker, value_context)
      marker == "--" || (value_context && marker == "====")
    end

    # Multi-name terms: aliases (status/docstage) get alias_of satellites;
    # grouped families (sponsor-address/-phone/...) get see satellites.
    def build_satellites(info, primary_entry)
      return [] unless info[:other_names].any?

      relation = info[:grouped] ? "see" : "alias_of"
      info[:other_names].map do |name|
        sat = { "category" => primary_entry["category"] }
        sat["subsection"] = primary_entry["subsection"] if primary_entry["subsection"]
        sat["repeatable"] = true if TermParser.repeatable?(name)
        sat[relation] = info[:key]
        { name => sat }
      end
    end

    def blank?(line)
      line.nil? || line.strip.empty?
    end
  end
end
