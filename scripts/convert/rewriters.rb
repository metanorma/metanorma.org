# frozen_string_literal: true

module Convert
  # Skip URLs with a scheme (http, https, ftp, mailto, irc, data).
  # Shared by SiteLinkRewriter and ImagePathNormalizer so the scheme
  # list lives in exactly one place.
  SCHEME_RE = %r{\A(https?|ftp|mailto|irc|data):}i.freeze

  # Post-parse link/xref rewriter.
  #
  # Replaces former text-level regex convert_internal_links. Coradoc's
  # rewrite_links walks the parsed AST and skips verbatim block types by
  # construction.
  #
  # Rules:
  #   - Skip URLs with a scheme (http, https, ftp, mailto, irc, data).
  #   - _posts/YYYY-MM-DD-slug.adoc → blog/YYYY-MM-DD-slug.
  #   - snake_case → kebab-case per segment.
  #   - Strip .adoc extension.
  #   - Sibling-relative links MUST resolve against the source file's
  #     output directory; the clean-URL restructure (page.html →
  #     page/index.html) otherwise resolves against the wrong base.
  #   - Preserve any #fragment.
  class SiteLinkRewriter
    BLOG_LEGACY_RE = %r{\A(.*/blog/)(\d{2})-(\d{2})-(\d{4})/(.+)\z}.freeze
    BLOG_JEKYLL_RE = %r{\A(.*/blog/)(\d{4})/(\d{2})/(\d{2})/(.+)\z}.freeze

    def initialize(source_output_key:)
      @source_output_key = source_output_key
    end

    def call(target:, kind:, context:)
      return target if target.match?(SCHEME_RE)
      return target if target.start_with?("//")

      path, fragment = target.split("#", 2)

      return target if pure_in_page_anchor?(path:, fragment:, kind:)

      if (m = path.match(BLOG_LEGACY_RE))
        path = "#{m[1]}#{m[4]}-#{m[2]}-#{m[3]}-#{m[5]}"
      end

      if (m = path.match(BLOG_JEKYLL_RE))
        path = "#{m[1]}#{m[2]}-#{m[3]}-#{m[4]}-#{m[5]}"
      end

      path = path.split("/").map { |seg| PathMapping.kebab_segment(seg) }.join("/")
      path = path.sub(/\.adoc\z/, "")
      path = Convert.resolve_against_output_dir(path, @source_output_key)
      path = File.expand_path(path) if path.include?("..")
      path = path.chomp("/") + "/" unless path.end_with?("/")

      fragment ? "#{path}##{fragment}" : path
    end

    private

    def pure_in_page_anchor?(path:, fragment:, kind:)
      return false unless kind == :xref
      return false if fragment
      path !~ /[\/.]/
    end
  end

  # Custom include resolver: tries file-relative first, then site-root-relative
  # (legacy Jekyll pattern in the corpus).
  class SiteRootFallbackResolver
    def initialize(site_root:)
      @site_root = site_root
      @filesystem = Coradoc::IncludeResolver::Filesystem.new(base_dir: site_root)
    end

    def call(target:, base_dir:, options:, context:)
      @filesystem.call(target: target, base_dir: base_dir, options: options, context: context)
    rescue Coradoc::IncludeNotFoundError
      @filesystem.call(target: target, base_dir: @site_root, options: options, context: context)
    end
  end

  # Mutates Image#src in place. Same root cause as SiteLinkRewriter's
  # sibling-relative resolution: the clean-URL restructure shifts the
  # rendered page one level deeper, breaking relative image srcs.
  class ImagePathNormalizer
    CONTAINER_READERS = {
      Coradoc::CoreModel::DocumentElement => :children,
      Coradoc::CoreModel::SectionElement => :children,
      Coradoc::CoreModel::PreambleElement => :children,
      Coradoc::CoreModel::HeaderElement => :children,
      Coradoc::CoreModel::Block => :children,
      Coradoc::CoreModel::ParagraphBlock => :children,
      Coradoc::CoreModel::ListBlock => :items,
      Coradoc::CoreModel::ListItem => :children,
      Coradoc::CoreModel::Table => :rows,
      Coradoc::CoreModel::TableRow => :cells,
      Coradoc::CoreModel::TableCell => :children,
      Coradoc::CoreModel::DefinitionList => :items,
      Coradoc::CoreModel::Toc => :entries,
      Coradoc::CoreModel::Bibliography => :entries,
      Coradoc::CoreModel::AnnotationBlock => :children,
    }.freeze

    def initialize(source_output_key:)
      @source_output_key = source_output_key
    end

    def normalize!(node)
      return if node.nil?
      rewrite_image(node) if node.is_a?(Coradoc::CoreModel::Image)
      children = child_collection(node)
      children&.each { |child| normalize!(child) }
    end

    private

    def child_collection(node)
      reader = CONTAINER_READERS.each_pair.find { |klass, _| node.is_a?(klass) }&.last
      reader ? node.public_send(reader) : nil
    end

    def rewrite_image(image)
      src = image.src.to_s
      return if src.empty?
      return if src.match?(SCHEME_RE)
      return if src.start_with?("//", "/")

      image.src = Convert.resolve_against_output_dir(src, @source_output_key)
    end
  end
end
