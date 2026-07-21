# frozen_string_literal: true

module Convert
  # Loads src/config/sections.yml once and is the single lookup point for
  # section knowledge: which section owns a source dir, output path
  # mapping, legacy redirects, nav roots, and the directories sources.rb
  # scans for source files and assets.
  class SectionRegistry
    include Enumerable

    attr_reader :sections

    def self.load(path = Convert::SECTIONS_CONFIG)
      data = YAML.load_file(path)
      entries = data.fetch("sections").map do |attrs|
        Section.new(**attrs.transform_keys(&:to_sym))
      end
      new(entries)
    end

    def initialize(sections)
      @sections = sections
    end

    def each(&block)
      @sections.each(&block)
    end

    # The section owning source files in rel_dir: exact source_dir match
    # first, then the longest recursive (tree/prefix) prefix match.
    def for_source_dir(rel_dir)
      exact = @sections.find { |s| s.source_dir == rel_dir }
      return exact if exact
      @sections.select { |s| s.recursive? && rel_dir.start_with?("#{s.source_dir}/") }
               .max_by { |s| s.source_dir.length }
    end

    def for_output_prefix(prefix)
      @sections.find { |s| s.output_prefix == prefix }
    end

    # Map a source file to its output key. Files no section claims get the
    # historic generic fallback mapping (see Section.fallback).
    def map_output_path(rel_dir, filename)
      (for_source_dir(rel_dir) || Section.fallback).map_output_path(rel_dir, filename)
    end

    def legacy_redirects_for(rel_path, output_key, frontmatter_date: nil)
      section = for_source_dir(File.dirname(rel_path)) || Section.fallback
      section.legacy_redirects_for(rel_path, output_key, frontmatter_date: frontmatter_date)
    end

    # Reverse-map an output path's first segment back to its source
    # directory. Only identity (tree) sections are considered — other
    # kinds keep the first output segment, matching historic behavior.
    def source_dir_for_output(rel_output)
      segments = rel_output.split("/")
      first = segments.first
      section = @sections.find { |s| s.mapping == "tree" && s.output_prefix == first }
      segments[0] = section ? section.source_dir : first
      segments.join("/")
    end

    def nav_roots
      @sections.select(&:nav_root?)
    end

    # Top-level source dirs: every section's source_dir minus those nested
    # under another section's source_dir (e.g. _pages/install under
    # _pages). sources.rb globs and copies assets from these.
    def top_level_source_dirs
      dirs = @sections.map(&:source_dir).compact.uniq
      dirs.reject { |d| dirs.any? { |other| other != d && d.start_with?("#{other}/") } }
    end

    # Union of the source extensions of all sections at or under dir.
    def source_extensions_under(dir)
      @sections.select { |s| s.source_dir == dir || s.source_dir&.start_with?("#{dir}/") }
               .flat_map(&:source_extensions).uniq
    end
  end
end
