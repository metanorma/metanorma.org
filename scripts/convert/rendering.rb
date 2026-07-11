# frozen_string_literal: true

require "coradoc"
require "coradoc/mirror"
require "json"
require "fileutils"
require_relative "path_mapping"
require_relative "hub_synthesizer"

module Convert
  # Frontmatter parsing, page emission, and mirror-json envelope writing.
  module Rendering
    TextSplitter = Coradoc::CoreModel::FrontmatterBlock::TextSplitter
    Codec = Coradoc::CoreModel::FrontmatterBlock::Codec

    module_function

    def split_source(text)
      TextSplitter.call(text)
    end

    def read_frontmatter_data(text)
      split = split_source(text)
      return {} unless split.frontmatter? && !split.frontmatter.strip.empty?
      Codec.from_yaml(split.frontmatter).data
    rescue StandardError
      {}
    end

    # Assembles the result hash from a CoreModel DocumentElement.
    # Returns a hash with mirror_json, frontmatter, and title — the
    # caller writes the mirror-json envelope. No .md wrapper generation
    # (Astro reads JSON directly via the content loader).
    def build_result(core, adoc_path, output_key, legacy_redirects: [], output_dir:, site_root:, mirror_json_dir:)
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
      title = File.basename(adoc_path, ".adoc") if title.to_s.strip.empty?

      {
        title: title,
        mirror_json: mirror_json,
        frontmatter: frontmatter,
        frontmatter_yaml: frontmatter_yaml,
        source: adoc_path.sub("#{site_root}/", ""),
      }
    end

    def write_mirror_json(output_key, result, mirror_json_dir:)
      return if result[:mirror_json].nil?

      path = File.join(mirror_json_dir, "#{output_key}.json")
      FileUtils.mkdir_p(File.dirname(path))
      envelope = {
        source: result[:source] || output_key,
        frontmatter: result[:frontmatter] || {},
        title: result[:title] || "",
        mirror_json: result[:mirror_json],
      }
      File.write(path, JSON.generate(envelope))
    end

    # Synthesizes a hub page listing child .adoc files when the source has
    # an empty body but a same-named subdirectory of children.
    def generate_hub_page(adoc_path, output_key, legacy_redirects: [], output_dir:, site_root:, mirror_json_dir:)
      fm_data = read_frontmatter_data(File.read(adoc_path))
      title = fm_data["title"] || PathMapping.slug_to_title(File.basename(adoc_path, ".adoc"))
      source_dir = File.dirname(adoc_path)
      base_name = File.basename(adoc_path, ".adoc")
      subdir = File.join(source_dir, base_name)

      children = []
      if File.directory?(subdir)
        children = Dir.glob(File.join(subdir, "*.adoc")).sort.map do |child|
          child_base = File.basename(child, ".adoc")
          child_fm = read_frontmatter_data(File.read(child))
          child_title = child_fm["title"].to_s.strip
          child_title = PathMapping.slug_to_title(child_base) if child_title.empty?
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
      build_result(core, adoc_path, output_key, legacy_redirects:, output_dir:, site_root:, mirror_json_dir:)
    end

    def synthesize_placeholder(adoc_path, output_key, legacy_redirects: [], output_dir:, site_root:, mirror_json_dir:)
      fm_data = read_frontmatter_data(File.read(adoc_path))
      title = fm_data["title"] || PathMapping.slug_to_title(File.basename(adoc_path, ".adoc"))
      description = fm_data["description"].to_s.strip

      core_children = [Coradoc::CoreModel::FrontmatterBlock.new(data: fm_data.merge("title" => title))]
      unless description.empty?
        core_children << Coradoc::CoreModel::ParagraphBlock.new(content: description)
      end
      core_children << Coradoc::CoreModel::ParagraphBlock.new(
        children: [Coradoc::CoreModel::ItalicElement.new(content: "This page is a placeholder. Content is forthcoming.")]
      )

      core = Coradoc::CoreModel::DocumentElement.build(title: title, children: core_children)
      build_result(core, adoc_path, output_key, legacy_redirects:, output_dir:, site_root:, mirror_json_dir:)
    end

    # Per-file pipeline: read → split frontmatter → parse → resolve includes →
    # normalize images → rewrite links → build result (or synthesize if empty).
    def convert_file(adoc_path, output_key, legacy_redirects: [], output_dir:, site_root:, mirror_json_dir:)
      text = File.read(adoc_path)
      split = split_source(text)

      begin
        full_text = if split.frontmatter?
                      "---\n#{split.frontmatter}\n---\n\n#{split.body}"
                    else
                      split.body
                    end
        core = Coradoc.parse(full_text, format: :asciidoc)
        core = Coradoc.resolve_includes(
          core,
          base_dir: File.dirname(adoc_path),
          missing_include: :passthrough,
          resolver: SiteRootFallbackResolver.new(site_root: site_root),
        )
        # Image src must be normalized BEFORE rewrite_links, because both
        # passes depend on the source file's output_key and rewrite_links
        # returns a NEW tree (later mutations on the old tree are lost).
        ImagePathNormalizer.new(source_output_key: output_key).normalize!(core)
        core = Coradoc.rewrite_links(core, rewriter: SiteLinkRewriter.new(source_output_key: output_key))
      rescue StandardError => e
        return { error: "#{e.class}: #{e.message}"[0..200] }
      end

      if core.empty_body?
        return generate_hub_page(adoc_path, output_key, legacy_redirects:, output_dir:, site_root:, mirror_json_dir:) ||
               synthesize_placeholder(adoc_path, output_key, legacy_redirects:, output_dir:, site_root:, mirror_json_dir:)
      end

      build_result(core, adoc_path, output_key, legacy_redirects:, output_dir:, site_root:, mirror_json_dir:)
    end
  end
end
