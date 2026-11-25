# frozen_string_literal: true

module Convert
  # Synthesizes Hub Pages — index pages for directories that have child
  # pages but no explicit index source.
  #
  # Previously two independent implementations existed: rendering.rb's
  # generate_hub_page (source-level, .adoc children) and convert-adoc.rb
  # Pass 2 (mirror-json-level, .json children). Both built the same
  # structure: FrontmatterBlock + ListBlock of links, wrapped in a
  # DocumentElement. This module is the single home for that pattern.
  module HubSynthesizer
    module_function

    # Frontmatter blocks are built through the typed Codec (ceradoc's
    # FrontmatterBlock carries a typed entry tree, not a data hash).
    Codec = Ceradoc::CoreModel::FrontmatterBlock::Codec

    # Build a CoreModel DocumentElement for a hub page.
    #
    # children: Array of { title:, slug: } hashes
    # title:    Hub page title
    # url_prefix: Prefix for child links (e.g., "author/basics")
    # description: Optional intro paragraph
    def build_document(title:, children:, url_prefix:, description: nil)
      core_children = [Codec.from_hash({ "title" => title })]
      if description && !description.to_s.strip.empty?
        core_children << Ceradoc::CoreModel::ParagraphBlock.new(content: description.to_s)
      end
      unless children.empty?
        core_children << Ceradoc::CoreModel::ListBlock.build(marker_type: "unordered") do |ul|
          children.each { |c| ul.add_item { |li| li.add_link("/#{url_prefix}/#{c[:slug]}/", text: c[:title]) } }
        end
      end
      Ceradoc::CoreModel::DocumentElement.build(title: title, children: core_children)
    end
  end
end
