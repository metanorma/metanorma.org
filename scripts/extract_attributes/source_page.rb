# frozen_string_literal: true

require "coradoc"
require "coradoc/asciidoc"

module ExtractAttributes
  # One source .adoc page: raw body lines (frontmatter split off) plus the
  # coradoc parse of the body (used by AstCrosscheck).
  class SourcePage
    attr_reader :path, :body_lines, :frontmatter, :document

    def self.load(relative_path)
      new(File.expand_path(relative_path, SITE_ROOT), relative_path)
    end

    def initialize(abs_path, relative_path = abs_path)
      @path = relative_path
      text = File.read(abs_path)
      @frontmatter = text[/\A---\n.*?\n---\n/m]
      body = @frontmatter ? text[@frontmatter.length..] : text
      @body_lines = body.lines(chomp: true)
      @document = Coradoc.parse(body, format: :asciidoc)
    end
  end
end
