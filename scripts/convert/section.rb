# frozen_string_literal: true

module Convert
  # Value object over one src/config/sections.yml entry. A section knows
  # which source files it owns and how to map them to output keys and
  # legacy redirect URLs. See sections.yml for the mapping kind semantics.
  class Section
    MAPPING_KINDS = %w[tree prefix date_prefix fixed ref_strip fallback].freeze

    attr_reader :id, :source_dir, :output_prefix, :mapping, :files, :source_extensions

    def initialize(id:, source_dir:, output_prefix:, mapping:, nav_root: false, files: {}, source_extensions: %w[adoc])
      @id = id
      @source_dir = source_dir
      @output_prefix = output_prefix
      @mapping = mapping
      @nav_root = nav_root
      @files = files
      @source_extensions = source_extensions
      raise ArgumentError, "unknown mapping kind: #{mapping}" unless MAPPING_KINDS.include?(mapping)
    end

    # Section used for source files no registry section claims. Reproduces
    # the historic generic mapping: the _pages/ prefix is dropped and every
    # path segment is kebabed.
    def self.fallback
      new(id: "(fallback)", source_dir: nil, output_prefix: nil, mapping: "fallback")
    end

    def nav_root?
      @nav_root
    end

    # Tree/prefix sections own their whole subtree; the other kinds only
    # own files directly inside source_dir.
    def recursive?
      mapping == "tree" || mapping == "prefix"
    end

    def matches?(rel_dir)
      return false if source_dir.nil?
      return true if rel_dir == source_dir
      recursive? && rel_dir.start_with?("#{source_dir}/")
    end

    # Map a source file (rel_dir + filename, both repo-root relative) to
    # its mirror-json output key, or nil when the section does not map it
    # (fixed: unlisted file; date_prefix: no date in the filename).
    def map_output_path(rel_dir, filename)
      case mapping
      when "fixed"
        files[filename]
      when "date_prefix"
        info = PathMapping.extract_blog_slug(filename)
        info && "#{output_prefix}/#{info[:year]}-#{info[:month]}-#{info[:day]}-#{info[:slug]}"
      when "ref_strip"
        base = PathMapping.strip_src_ext(filename).sub(/^Ref-/, "").downcase
        "#{output_prefix}/#{PathMapping.kebab_segment(base)}"
      when "tree"
        subtree_output(rel_dir, filename, strip: :adoc)
      when "prefix"
        subtree_output(rel_dir, filename, strip: :src)
      when "fallback"
        dir = rel_dir.sub(%r{\A_pages/}, "")
        "#{PathMapping.kebab_path(dir)}/#{PathMapping.kebab_segment(PathMapping.strip_src_ext(filename))}"
      end
    end

    # Legacy production URLs that should redirect to the output key.
    def legacy_redirects_for(rel_path, output_key, frontmatter_date: nil)
      case mapping
      when "date_prefix"
        redirects = []
        if frontmatter_date && frontmatter_date != PathMapping.filename_date(rel_path)
          slug = File.basename(rel_path, ".adoc").sub(/\A\d{4}-\d{2}-\d{2}-/, "")
          redirects << "/#{output_prefix}/#{frontmatter_date}-#{slug}/"
        end
        redirects
      when "ref_strip"
        base = File.basename(rel_path, File.extname(rel_path))
        prod = "#{source_dir}/#{base}"
        prod == output_key ? [] : ["/#{prod}/"]
      else
        prod = production_path(rel_path)
        prod == output_key ? [] : ["/#{prod}/"]
      end
    end

    private

    # Shared tree/prefix mapping: output_prefix + kebabed subpath under
    # source_dir + kebabed basename. `tree` strips only .adoc; `prefix`
    # (legacy _pages subdirs) also strips .html.
    def subtree_output(rel_dir, filename, strip:)
      base = strip == :adoc ? PathMapping.strip_adoc_ext(filename) : PathMapping.strip_src_ext(filename)
      subdir = rel_dir == source_dir ? nil : rel_dir.delete_prefix("#{source_dir}/")
      segments = [output_prefix, subdir && PathMapping.kebab_path(subdir), PathMapping.kebab_segment(base)]
      segments.compact.reject(&:empty?).join("/")
    end

    # The historic production path for a source file: section source_dir
    # rewritten to output_prefix (a no-op for tree sections, where they
    # are identical), or the _pages/ strip for section-less/fixed paths.
    def production_path(rel_path)
      prod = rel_path
      if source_dir && !output_prefix.nil? && source_dir != output_prefix
        replacement = output_prefix.empty? ? "" : "#{output_prefix}/"
        prod = prod.sub(%r{\A#{Regexp.escape(source_dir)}/?}, replacement)
      else
        prod = prod.sub(%r{\A_pages/}, "")
      end
      prod.sub(/\.(adoc|html)\z/, "")
    end
  end
end
