# frozen_string_literal: true

require "coradoc"
require_relative "path_mapping"

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

    # Build a CoreModel DocumentElement for a hub page.
    #
    # children: Array of { title:, slug: } hashes
    # title:    Hub page title
    # url_prefix: Prefix for child links (e.g., "author/basics")
    # description: Optional intro paragraph
    def build_document(title:, children:, url_prefix:, description: nil)
      core_children = [Coradoc::CoreModel::FrontmatterBlock.new(data: { "title" => title })]
      if description && !description.to_s.strip.empty?
        core_children << Coradoc::CoreModel::ParagraphBlock.new(content: description.to_s)
      end
      unless children.empty?
        core_children << Coradoc::CoreModel::ListBlock.build(marker_type: "unordered") do |ul|
          children.each { |c| ul.add_item { |li| li.add_link("/#{url_prefix}/#{c[:slug]}/", text: c[:title]) } }
        end
      end
      Coradoc::CoreModel::DocumentElement.build(title: title, children: core_children)
    end
  end
end
