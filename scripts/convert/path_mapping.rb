# frozen_string_literal: true

# Path and URL mapping for the converter.
#
# Encodes the source→output path transformation rules and the tables of
# superseded/special-cased files. The main script calls `map_output_path`
# per source file and `legacy_redirects_for` to compute redirect entries.
module Convert
  module PathMapping
    SITE_ROOT = File.expand_path("..", File.dirname(__dir__))

    MAPPING = {
      "_pages" => {
        "install.adoc" => "install/index",
        "author.adoc" => "author/index",
        "develop.adoc" => "develop/index",
        "learn.adoc" => "learn/index",
        "contribute.adoc" => "contribute/index",
        "reference_docs.adoc" => "reference/index",
      },
      "_pages/install" => { prefix: "install/" },
      "_posts" => { prefix: "blog/", date_prefix: true },
      "_software" => { prefix: "software/", data_driven: true },
      "_specs" => { prefix: "specs/" },
      "_samples" => { prefix: "samples/" },
    }.freeze

    SUPERSEDED = {
      "_pages/flavors.adoc"                              => "hand-authored pages/flavors/index.md",
      "_pages/docs.adoc"                                 => "pages/get-started.md via redirect_from: /docs/",
      "_pages/developer.adoc"                            => "pages/develop/index.md via redirect_from: /developer/",
      "_pages/software.html"                             => "hand-authored pages/software/index.md",
      "_pages/blog.html"                                 => "hand-authored pages/blog/index.md",
      "_pages/reference_docs.adoc"                       => "hand-authored pages/reference/index.md (richer than the empty stub source)",
      "_pages/samples.html"                              => "hub-synthesized pages/samples/index.md",
      "_pages/specs.html"                                => "hub-synthesized pages/specs/index.md",
      "_pages/vcard-format-specification-rendered.html"  => "stale derived HTML — not source content",
      # MPFA removed from site per product decision. Source files retained
      # per the never-delete-source rule; filtered out at collection time.
      "_software/metanorma-mpfa.adoc"                    => "MPFA removed from site",
      "_library/metanorma-mpfa.adoc"                     => "MPFA removed from site",
      "author/mpfa.adoc"                                 => "MPFA removed from site",
      "author/mpfa/authoring.adoc"                       => "MPFA removed from site",
      "author/mpfa/sample.adoc"                          => "MPFA removed from site",
    }.freeze

    DIR_MAPPINGS = {
      "author"         => "author",
      "develop"        => "develop",
      "learn"          => "learn",
      "_software"      => "software",
      "_specs"         => "specs",
      "_samples"       => "samples",
      "_library"       => "library",
    }.freeze

    # Single source of truth for all directories that contain source
    # .adoc files or assets. sources.rb derives its glob patterns and
    # asset copy list from this; DIR_MAPPINGS provides the output
    # mapping for each entry.
    SOURCE_DIRS = %w[
      author
      _posts
      develop
      learn
      reference_docs
      _software
      _specs
      _samples
      _library
      _pages
    ].freeze

    module_function

    def site_root
      SITE_ROOT
    end

    def kebab(s)
      s.tr("_", "-")
    end

    def slug_to_title(slug)
      slug.split("-").map(&:capitalize).join(" ")
    end

    def strip_adoc_ext(filename)
      filename.sub(/\.adoc\z/, "")
    end

    def strip_src_ext(filename)
      filename.sub(/\.(adoc|html)\z/, "")
    end

    def extract_blog_slug(filename)
      if filename =~ /\A(\d{4})-(\d{2})-(\d{2})-(.+)\.adoc\z/
        { year: Regexp.last_match(1), month: Regexp.last_match(2), day: Regexp.last_match(3), slug: Regexp.last_match(4) }
      end
    end

    def filename_date(rel_path)
      File.basename(rel_path, ".adoc")[/\A\d{4}-\d{2}-\d{2}/, 0]
    end

    def map_output_path(source_dir, filename)
      rel_dir = source_dir.sub("#{SITE_ROOT}/", "")

      return MAPPING["_pages"][filename] if rel_dir == "_pages"

      if rel_dir == "_posts"
        info = extract_blog_slug(filename)
        return info && "blog/#{info[:year]}-#{info[:month]}-#{info[:day]}-#{info[:slug]}"
      end

      if rel_dir =~ %r{\A_pages/(.+)\z}
        subdir = kebab(Regexp.last_match(1))
        return "#{subdir}/#{kebab(strip_src_ext(filename))}"
      end

      if rel_dir == "reference_docs"
        base = strip_src_ext(filename).sub(/^Ref-/, "").downcase
        return "reference/#{kebab(base)}"
      end

      DIR_MAPPINGS.each do |src, dest|
        return "#{dest}/#{kebab(strip_adoc_ext(filename))}" if rel_dir == src
        if rel_dir =~ %r{\A#{Regexp.escape(src)}/(.+)\z}
          subdir = kebab(Regexp.last_match(1))
          return "#{dest}/#{subdir}/#{kebab(strip_adoc_ext(filename))}"
        end
      end

      "#{kebab(rel_dir)}/#{kebab(strip_src_ext(filename))}"
    end

    def legacy_redirects_for(rel_path, output_key, frontmatter_date: nil)
      if rel_path.start_with?("_posts/")
        redirects = []
        if frontmatter_date && frontmatter_date != filename_date(rel_path)
          slug = File.basename(rel_path, ".adoc").sub(/\A\d{4}-\d{2}-\d{2}-/, "")
          redirects << "/blog/#{frontmatter_date}-#{slug}/"
        end
        return redirects
      end

      if rel_path.start_with?("reference_docs/")
        base = File.basename(rel_path, File.extname(rel_path))
        prod = "reference_docs/#{base}"
        return prod == output_key ? [] : ["/#{prod}/"]
      end

      # Derive the production path by applying each DIR_MAPPINGS rewrite
      # to the source-relative path, then stripping the _pages/ prefix
      # and the source extension. This keeps redirect generation in sync
      # with the mapping table — no separate hardcoded .sub() chain.
      prod = rel_path
      DIR_MAPPINGS.each do |src, dest|
        prod = prod.sub(/\A#{Regexp.escape(src)}\//, "#{dest}/")
      end
      prod = prod.sub(/\A_pages\//, "")
      prod = prod.sub(/\.(adoc|html)\z/, "")

      return [] if prod == output_key
      ["/#{prod}/"]
    end
  end
end
