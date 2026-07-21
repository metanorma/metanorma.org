# frozen_string_literal: true

module Convert
  # Orchestrates a conversion run:
  #   collect → convert (cache-aware) → hub synthesis → prune → manifest
  # and holds the run's stats and errors. All policy for *when* a file
  # is (re)converted lives here; *how* lives in Rendering.
  class Converter
    # file_map marker for pass-2 synthesized hubs. verify-content.mjs
    # matches on the `hub` flag, not this string.
    HUB_SOURCE = "synthesized hub"

    attr_reader :stats, :errors

    def initialize(site_root: Convert::SITE_ROOT,
                   config_path: Convert::SECTIONS_CONFIG,
                   mirror_json_dir: nil,
                   public_dir: nil,
                   force: false,
                   code_version: nil,
                   out: $stdout,
                   err: $stderr)
      @site_root = site_root
      @registry = SectionRegistry.load(config_path)
      @mirror_json_dir = mirror_json_dir || File.join(site_root, "mirror-json")
      @public_dir = public_dir || File.join(site_root, "public")
      @force = force
      @code_version = code_version || self.class.default_code_version(site_root)
      @out = out
      @err = err
      @nav_titles = NavTitles.new(site_root: site_root, err: err)
      @store = EnvelopeStore.new(@mirror_json_dir)
      @stats = { ok: 0, fail: 0, unmapped: 0, empty_hub: 0, cached: 0 }
      @errors = {}
    end

    # Stamp that invalidates every cached envelope when the converter
    # code itself changes: a digest of the converter scripts' mtimes.
    def self.default_code_version(site_root = Convert::SITE_ROOT)
      files = Dir.glob(File.join(site_root, "scripts", "convert", "*.rb"))
      files += [File.join(site_root, "scripts", "convert.rb"),
                File.join(site_root, "scripts", "convert-adoc.rb")]
      stamp = files.select { |f| File.file?(f) }.sort
                   .map { |f| "#{f.sub("#{site_root}/", "")}:#{File.mtime(f).to_f}" }
                   .join("\n")
      Digest::SHA256.hexdigest(stamp)[0, 16]
    end

    # Returns the process exit code (0 = no failures).
    def run
      @force ? @store.reset! : @store.prepare!

      # Copy non-adoc assets (images, PDFs, etc.) into public/.
      Sources.copy_assets(site_root: @site_root, public_dir: @public_dir, registry: @registry)

      scan_cache = {}
      source_files = Sources.collect(site_root: @site_root, registry: @registry,
                                     nav_titles: @nav_titles, scan_cache: scan_cache)
      old_file_map = @force ? {} : @store.read_file_map
      file_map = {}

      convert_pass(source_files, old_file_map, file_map)
      @err.puts
      hub_synthesis_pass(old_file_map, file_map)

      valid_keys = file_map.select { |_, info| %w[ok cached].include?(info[:status]) }.keys
      pruned = @store.prune(valid_keys)
      pruned.each { |key| @out.puts "  pruned orphan envelope: #{key}.json" }

      @store.write_manifest(
        generated_at: Time.now.utc.iso8601,
        code_version: @code_version,
        stats: @stats,
        total_files: source_files.length,
        file_map: file_map,
      )

      report(source_files.length)
      @stats[:fail] > 0 ? 1 : 0
    end

    private

    # Pass 1: convert each .adoc source into a mirror-json envelope.
    def convert_pass(source_files, old_file_map, file_map)
      source_files.each_with_index do |source_file, idx|
        output_key = source_file.output_key
        if output_key.nil?
          @stats[:unmapped] += 1
          @err.puts "  WARNING: no mapping entry for #{source_file.rel_path}"
          next
        end

        fingerprint = source_file.fingerprint(code_version: @code_version)
        entry = { source: source_file.rel_path, fingerprint: fingerprint, deps: source_file.dependencies }

        if cached?(old_file_map[output_key], output_key, fingerprint)
          @stats[:cached] += 1
          file_map[output_key] = entry.merge(status: "cached")
          next
        end

        @err.printf("\r[%d/%d] %-60s", idx + 1, source_files.length, source_file.filename) if idx % 5 == 0

        result = Rendering.convert_file(
          source_file, output_key,
          legacy_redirects: source_file.legacy_redirects,
          site_root: @site_root, nav: @nav_titles,
        )
        conversion = Conversion.new(output_key: output_key, data: result)

        if conversion.empty?
          @stats[:empty_hub] += 1
        elsif conversion.error
          @stats[:fail] += 1
          @errors[source_file.rel_path] = conversion.error
          file_map[output_key] = entry.merge(status: "error", error: conversion.error)
        else
          @store.write(conversion)
          @stats[:ok] += 1
          file_map[output_key] = entry.merge(status: "ok")
        end
      end
    end

    # Pass 2: synthesize hub pages for any mirror-json directory that has
    # child entries but no index entry and no sibling <dirname> entry at
    # the parent level. Hubs synthesized in previous runs are cache-managed
    # (kept in the file map, refreshed when their inputs change).
    def hub_synthesis_pass(old_file_map, file_map)
      Find.find(@mirror_json_dir) do |path|
        next unless File.directory?(path)
        next if path == @mirror_json_dir

        rel_dir = path.sub("#{@mirror_json_dir}/", "")

        next if rel_dir =~ %r{\Ablog/\d{4}\z}

        sibling_json = File.join(File.dirname(path), "#{File.basename(path)}.json")
        next if File.exist?(sibling_json)

        hub_output_key = "#{rel_dir}/index"
        index_json = File.join(path, "index.json")
        old_hub = old_file_map[hub_output_key]

        if File.exist?(index_json)
          # An existing index is either a real converted page (left alone,
          # historic behavior) or a hub synthesized by a previous run.
          next unless old_hub && old_hub["hub"] == true
          # A real page converted THIS run at the same key takes precedence.
          next if file_map.key?(hub_output_key)
        end

        children = Dir.glob(File.join(path, "*.json")).reject { |f| File.basename(f) == "index.json" || File.basename(f) == "manifest.json" }.sort
        next if children.empty?

        fingerprint = hub_fingerprint(rel_dir, children)
        deps = children.map { |c| c.sub("#{@mirror_json_dir}/", "") }

        if cached?(old_hub, hub_output_key, fingerprint)
          @stats[:cached] += 1
          file_map[hub_output_key] = { status: "cached", source: HUB_SOURCE, hub: true, fingerprint: fingerprint, deps: deps }
          next
        end

        synthesize_hub(path, rel_dir, children, hub_output_key, file_map, fingerprint, deps)
      end
    end

    def synthesize_hub(path, rel_dir, children, hub_output_key, file_map, fingerprint, deps)
      source_rel = @registry.source_dir_for_output(rel_dir)
      title = @nav_titles.title_for(File.dirname(source_rel), File.basename(source_rel)) || File.basename(path)

      child_items = children.map do |child|
        child_base = File.basename(child, ".json")
        begin
          child_envelope = JSON.parse(File.read(child))
          child_title = child_envelope["title"].to_s.strip
        rescue StandardError
          child_title = ""
        end
        child_title = @nav_titles.title_for(source_rel, child_base) || child_title if child_title.empty?
        child_title = child_base if child_title.empty?
        { title: child_title, slug: child_base }
      end

      # Same error guard as convert_file's parse/transform steps: one bad
      # hub must surface as a per-file error, not kill the whole run.
      begin
        core = HubSynthesizer.build_document(
          title: title,
          children: child_items,
          url_prefix: rel_dir,
        )

        result = Rendering.build_result(core, path, hub_output_key, site_root: @site_root, nav: @nav_titles)
        @store.write(Conversion.new(output_key: hub_output_key, data: result))
        file_map[hub_output_key] = { status: "ok", source: HUB_SOURCE, hub: true, fingerprint: fingerprint, deps: deps }
        @stats[:ok] += 1
      rescue StandardError => e
        @stats[:fail] += 1
        @errors["#{rel_dir}/ (synthesized hub)"] = "#{e.class}: #{e.message}"[0..200]
      end
    end

    # Cache hit = an envelope exists on disk, the previous run converted
    # it successfully, and its fingerprint (source + include deps + nav
    # files + converter code version) is unchanged.
    def cached?(old_entry, output_key, fingerprint)
      return false if @force
      return false if old_entry.nil?
      return false unless %w[ok cached].include?(old_entry["status"])
      return false unless @store.exist?(output_key)
      old_entry["fingerprint"] == fingerprint
    end

    # Fingerprint for a synthesized hub: its child envelopes' mtimes plus
    # the _nav.yml files of the section the hub belongs to (nav titles
    # feed hub titles) plus the converter code version.
    def hub_fingerprint(rel_dir, children)
      digest = Digest::SHA256.new
      digest << @code_version.to_s << "\n" << "hub:" << rel_dir << "\n"
      children.each do |child|
        digest << child.sub("#{@mirror_json_dir}/", "") << "=" << File.mtime(child).to_f.to_s << "\n"
      end
      source_rel = @registry.source_dir_for_output(rel_dir)
      @nav_titles.files_under(source_rel.split("/").first).each do |rel|
        full = File.join(@site_root, rel)
        digest << rel << "=" << File.mtime(full).to_f.to_s << "\n"
      end
      digest.hexdigest
    end

    def report(total_files)
      @out.puts "Conversion complete:"
      @out.puts "  OK: #{@stats[:ok]}"
      @out.puts "  CACHED: #{@stats[:cached]}"
      @out.puts "  FAIL: #{@stats[:fail]}"
      @out.puts "  EMPTY-HUB: #{@stats[:empty_hub]}"
      @out.puts "  UNMAPPED: #{@stats[:unmapped]}"
      @out.puts "  SUPERSEDED: #{PathMapping::SUPERSEDED.size} (excluded at source collection)"
      @out.puts "  TOTAL: #{total_files}"
      @out.puts ""

      if @stats[:unmapped] > 0
        @out.puts "WARNING: #{@stats[:unmapped]} file(s) had no mapping entry (see warnings above)"
        @out.puts ""
      end

      if @stats[:fail] > 0
        @out.puts "Errors (first 20):"
        @errors.first(20).each do |f, e|
          @out.puts "  #{f}: #{e}"
        end
        @out.puts "  ... (#{@errors.length} total errors)" if @errors.length > 20
      end
    end
  end
end
