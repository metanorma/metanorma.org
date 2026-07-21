# frozen_string_literal: true

module Convert
  # Frontmatter parsing, page emission, and the per-file conversion
  # pipeline. Pure functions over SourceFile/NavTitles — the orchestration
  # (caching, writing, stats) lives in Converter/EnvelopeStore.
  module Rendering
    TextSplitter = Coradoc::CoreModel::FrontmatterBlock::TextSplitter
    Codec = Coradoc::CoreModel::FrontmatterBlock::Codec

    module_function

    def split_source(text)
      TextSplitter.call(text)
    end

    # Parsed YAML frontmatter as a Hash ({} when absent or malformed).
    # Coradoc's Codec swallows malformed YAML (logging its own warning
    # without a filename); detect that case and log it with the source
    # path instead of letting it pass silently.
    def read_frontmatter_data(text, path: nil)
      split = split_source(text)
      return {} unless split.frontmatter? && !split.frontmatter.strip.empty?
      data = Codec.from_yaml(split.frontmatter).data
      if data.nil? || (data.respond_to?(:empty?) && data.empty?)
        begin
          YAML.parse(split.frontmatter)
        rescue StandardError => e
          warn "  WARNING: could not parse frontmatter in #{path || '(inline text)'}: #{e.message}"
        end
      end
      data || {}
    rescue StandardError => e
      warn "  WARNING: could not parse frontmatter in #{path || '(inline text)'}: #{e.message}"
      {}
    end

    # Assembles the result hash from a CoreModel DocumentElement.
    # Returns a hash with mirror_json, frontmatter, and title — the
    # caller writes the mirror-json envelope. No .md wrapper generation
    # (Astro reads JSON directly via the content loader).
    def build_result(core, adoc_path, output_key, legacy_redirects: [], site_root:, nav:)
      mirror_doc = Coradoc::Mirror.transform(core, partition_structural: true)
      mirror_json = mirror_doc.to_json
      frontmatter = Coradoc::Mirror::FrontmatterQuery.to_hash(mirror_doc)

      fm_block = core.children&.find { |c| c.is_a?(Coradoc::CoreModel::FrontmatterBlock) }

      if !legacy_redirects.empty?
        fm_block ||= Coradoc::CoreModel::FrontmatterBlock.new(data: {})
        existing = Array(fm_block.data["redirect_from"])
        fm_block.data["redirect_from"] = (existing + legacy_redirects).uniq
      end

      frontmatter_yaml = fm_block ? Codec.to_yaml(fm_block) : ""

      if !legacy_redirects.empty?
        frontmatter["redirect_from"] = Array(frontmatter["redirect_from"]) + legacy_redirects
        frontmatter["redirect_from"].uniq!
      end

      title = frontmatter["title"] || core.title.to_s
      if title.to_s.strip.empty?
        rel_dir = adoc_path.sub("#{site_root}/", "").sub(/\/[^\/]+$/, "")
        title = nav.title_for(rel_dir, File.basename(adoc_path, ".adoc")) || File.basename(adoc_path, ".adoc")
      end

      {
        title: title,
        mirror_json: mirror_json,
        frontmatter: frontmatter,
        frontmatter_yaml: frontmatter_yaml,
        source: adoc_path.sub("#{site_root}/", ""),
      }
    end

    # Synthesizes a hub page listing child .adoc files when the source has
    # an empty body but a same-named subdirectory of children.
    def generate_hub_page(source_file, output_key, legacy_redirects: [], site_root:, nav:)
      adoc_path = source_file.path
      fm_data = source_file.frontmatter_data
      rel_dir = File.dirname(adoc_path).sub("#{site_root}/", "")
      title = fm_data["title"] || nav.title_for(rel_dir, File.basename(adoc_path, ".adoc")) || File.basename(adoc_path, ".adoc")
      source_dir = File.dirname(adoc_path)
      base_name = File.basename(adoc_path, ".adoc")
      subdir = File.join(source_dir, base_name)

      children = []
      if File.directory?(subdir)
        children = Dir.glob(File.join(subdir, "*.adoc")).sort.map do |child|
          child_base = File.basename(child, ".adoc")
          child_fm = read_frontmatter_data(File.read(child), path: child.sub("#{site_root}/", ""))
          child_title = child_fm["title"].to_s.strip
          child_title = nav.title_for("#{rel_dir}/#{base_name}", child_base) || child_base if child_title.empty?
          { title: child_title, slug: child_base }
        end
      end

      return nil if children.empty? && fm_data["description"].nil?

      core = HubSynthesizer.build_document(
        title: title,
        children: children,
        url_prefix: output_key,
        description: fm_data["description"],
      )
      build_result(core, adoc_path, output_key, legacy_redirects:, site_root:, nav:)
    end

    def synthesize_placeholder(source_file, output_key, legacy_redirects: [], site_root:, nav:)
      adoc_path = source_file.path
      fm_data = source_file.frontmatter_data
      rel_dir = File.dirname(adoc_path).sub("#{site_root}/", "")
      title = fm_data["title"] || nav.title_for(rel_dir, File.basename(adoc_path, ".adoc")) || File.basename(adoc_path, ".adoc")
      description = fm_data["description"].to_s.strip

      core_children = [Coradoc::CoreModel::FrontmatterBlock.new(data: fm_data.merge("title" => title))]
      unless description.empty?
        core_children << Coradoc::CoreModel::ParagraphBlock.new(content: description)
      end
      core_children << Coradoc::CoreModel::ParagraphBlock.new(
        children: [Coradoc::CoreModel::ItalicElement.new(content: "This page is a placeholder. Content is forthcoming.")]
      )

      core = Coradoc::CoreModel::DocumentElement.build(title: title, children: core_children)
      build_result(core, adoc_path, output_key, legacy_redirects:, site_root:, nav:)
    end

    # Per-file pipeline: split frontmatter → parse → resolve includes →
    # normalize images → rewrite links → build result (or synthesize if
    # empty). The guard covers the post-parse steps (hub/placeholder
    # synthesis and build_result) too: a mirror-transform exception must
    # surface as a per-file error with context, not kill the whole run.
    def convert_file(source_file, output_key, legacy_redirects: [], site_root:, nav:)
      split = split_source(source_file.content)

      begin
        full_text = if split.frontmatter?
                      "---\n#{split.frontmatter}\n---\n\n#{split.body}"
                    else
                      split.body
                    end
        core = Coradoc.parse(full_text, format: :asciidoc)
        core = Coradoc.resolve_includes(
          core,
          base_dir: File.dirname(source_file.path),
          missing_include: :passthrough,
          resolver: SiteRootFallbackResolver.new(site_root: site_root),
        )
        # Image src must be normalized BEFORE rewrite_links, because both
        # passes depend on the source file's output_key and rewrite_links
        # returns a NEW tree (later mutations on the old tree are lost).
        ImagePathNormalizer.new(source_output_key: output_key).normalize!(core)
        core = Coradoc.rewrite_links(core, rewriter: SiteLinkRewriter.new(source_output_key: output_key))

        if core.empty_body?
          return generate_hub_page(source_file, output_key, legacy_redirects:, site_root:, nav:) ||
                 synthesize_placeholder(source_file, output_key, legacy_redirects:, site_root:, nav:)
        end

        build_result(core, source_file.path, output_key, legacy_redirects:, site_root:, nav:)
      rescue StandardError => e
        { error: "#{e.class}: #{e.message}"[0..200] }
      end
    end
  end
end
