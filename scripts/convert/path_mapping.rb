# frozen_string_literal: true

module Convert
  # Section-independent path/URL string helpers, plus the table of
  # superseded source files.
  #
  # All section knowledge (source dirs, output prefixes, mapping kinds)
  # lives in src/config/sections.yml and is exposed through
  # Convert::SectionRegistry. This module keeps only the string
  # transforms that sections, rewriters, and sources share — kebab in
  # particular has exactly one implementation here (kebab_segment).
  module PathMapping
    SITE_ROOT = Convert::SITE_ROOT

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
      # reference_docs/Ref-*.adoc — old reference docs superseded by
      # flavor-specific and author/ref pages. Not on production (404).
      "reference_docs/Ref-standoc-document-attributes.adoc" => "superseded by /author/ref/document-attributes/",
      "reference_docs/Ref-ISO-document-attributes.adoc"     => "superseded by /flavors/iso/ref/document-attributes/",
      # MPFA removed from site per product decision. Source files retained
      # per the never-delete-source rule; filtered out at collection time.
      "software/metanorma-mpfa.adoc"                    => "MPFA removed from site",
      "library/metanorma-mpfa.adoc"                     => "MPFA removed from site",
      "author/mpfa.adoc"                                 => "MPFA removed from site",
      "author/mpfa/authoring.adoc"                       => "MPFA removed from site",
      "author/mpfa/sample.adoc"                          => "MPFA removed from site",
      "flavors/mpfa.adoc"                                => "MPFA removed from site",
      "flavors/mpfa/authoring.adoc"                      => "MPFA removed from site",
      "flavors/mpfa/sample.adoc"                         => "MPFA removed from site",
      # /author/getting-started/ was org-adoption content misplaced in the
      # author area; merged into the developer landing page (/develop/).
      "author/getting-started.adoc"                      => "merged into /develop/ (developer documentation landing)",
      # The four document-attribute reference pages are now rendered from
      # the machine-readable manifests (attributes/*.yaml) by the named
      # Astro routes (registry: src/lib/attr-registry.ts) at the same
      # URLs. Sources stay on disk per the never-delete-source rule; the
      # prose companions (flavors/iso/ref/identifier-patterns.adoc,
      # flavors/ietf/ref/global-options.adoc) REMAIN live mirror pages.
      "author/ref/document-attributes.adoc"              => "superseded by attributes/standoc.yaml generated reference",
      "flavors/iso/ref/document-attributes.adoc"         => "superseded by attributes/iso.yaml generated reference",
      "flavors/ietf/ref/document-attributes.adoc"        => "superseded by attributes/ietf.yaml generated reference",
      "flavors/ietf/ref/document-attributes-v2.adoc"     => "superseded by attributes/ietf-v2.yaml generated reference",
      "flavors/iec/ref/document-attributes.adoc"         => "superseded by attributes/iec.yaml generated reference",
      "flavors/ieee/ref/document-attributes.adoc"        => "superseded by attributes/ieee.yaml generated reference",
      "flavors/itu/ref/document-attributes.adoc"         => "superseded by attributes/itu.yaml generated reference",
      "flavors/jis/ref/document-attributes.adoc"         => "superseded by attributes/jis.yaml generated reference",
      "flavors/iho/ref/document-attributes.adoc"         => "superseded by attributes/iho.yaml generated reference",
      "flavors/nist/ref/document-attributes.adoc"        => "superseded by attributes/nist.yaml generated reference",
      "flavors/bsi/ref/document-attributes.adoc"         => "superseded by attributes/bsi.yaml generated reference",
      "flavors/gb/ref/document-attributes.adoc"          => "superseded by attributes/gb.yaml generated reference",
      "flavors/plateau/ref/document-attributes.adoc"     => "superseded by attributes/plateau.yaml generated reference",
      "flavors/ogc/ref/document-attributes.adoc"         => "superseded by attributes/ogc.yaml generated reference",
      "flavors/bipm/ref/document-attributes.adoc"        => "superseded by attributes/bipm.yaml generated reference",
      # learn/template.html is an unfinished author scratch template (empty
      # <title>, Jekyll-era include notes), not content. Redirected to
      # /learn/; the file stays on disk per the never-delete-source rule.
      "learn/template.html"                              => "author scratch template, not content — redirected to /learn/",
    }.freeze

    module_function

    # THE kebab implementation. Every snake_case → kebab-case conversion
    # in the converter (output mapping, link rewriting, asset copying)
    # goes through this method.
    def kebab_segment(segment)
      segment.tr("_", "-")
    end

    # Kebab every segment of a slash-separated path.
    def kebab_path(path)
      path.split("/").map { |seg| kebab_segment(seg) }.join("/")
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
  end

  # Resolve a relative path against the source file's output directory.
  # The clean-URL restructure (page.html → page/index.html) shifts
  # rendered pages one level deeper, so sibling-relative paths must be
  # rebased against the parent directory of the output key.
  def self.resolve_against_output_dir(path, output_key)
    return path if path.start_with?("/")
    return path if output_key.nil? || output_key.empty?

    parent_dir = output_key.rpartition("/").first
    return path if parent_dir.empty?

    File.expand_path(path, "/#{parent_dir}")
  end
end
