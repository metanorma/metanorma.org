# frozen_string_literal: true

module Convert
  # Owns the mirror-json/ tree: writing envelopes, pruning orphans from
  # previous runs, and the run manifest.
  class EnvelopeStore
    MANIFEST_BASENAME = "manifest.json"

    attr_reader :dir

    def initialize(dir)
      @dir = dir
    end

    # Wipe the whole tree (the --clean path).
    def reset!
      FileUtils.rm_rf(@dir)
      FileUtils.mkdir_p(@dir)
    end

    def prepare!
      FileUtils.mkdir_p(@dir)
    end

    def path_for(output_key)
      File.join(@dir, "#{output_key}.json")
    end

    def exist?(output_key)
      File.exist?(path_for(output_key))
    end

    # Write the mirror-json envelope for a successful conversion.
    # Nothing is written when the conversion carries no mirror_json.
    def write(conversion)
      result = conversion.data
      return if result.nil? || result[:mirror_json].nil?

      path = path_for(conversion.output_key)
      FileUtils.mkdir_p(File.dirname(path))
      envelope = {
        source: result[:source] || conversion.output_key,
        frontmatter: result[:frontmatter] || {},
        title: result[:title] || "",
        mirror_json: result[:mirror_json],
      }
      File.write(path, JSON.generate(envelope))
    end

    def manifest_path
      File.join(@dir, MANIFEST_BASENAME)
    end

    # The previous run's manifest, or {} when missing/unparseable.
    def read_manifest
      return {} unless File.exist?(manifest_path)
      JSON.parse(File.read(manifest_path))
    rescue StandardError
      {}
    end

    def read_file_map
      read_manifest["file_map"] || {}
    end

    def write_manifest(manifest)
      File.write(manifest_path, JSON.pretty_generate(manifest))
    end

    # Delete every .json envelope that is not part of the current run's
    # valid set (keeping manifest.json), then remove directories left
    # empty. Returns the pruned output keys, sorted.
    def prune(valid_keys)
      valid = valid_keys.to_a
      pruned = []
      return pruned unless File.directory?(@dir)

      Find.find(@dir) do |path|
        next if File.directory?(path)
        next unless path.end_with?(".json")
        next if File.basename(path) == MANIFEST_BASENAME

        key = path.sub("#{@dir}/", "").sub(/\.json\z/, "")
        next if valid.include?(key)

        File.delete(path)
        pruned << key
      end

      # Remove directories left empty by the deletions, deepest first.
      Find.find(@dir).select { |p| File.directory?(p) && p != @dir }
          .sort_by { |p| -p.length }.each do |dir_path|
        Dir.rmdir(dir_path) if Dir.empty?(dir_path)
      end

      pruned.sort
    end
  end
end
