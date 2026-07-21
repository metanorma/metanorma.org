# frozen_string_literal: true

require "coradoc"
require "coradoc/asciidoc"
require "coradoc/mirror"
require "json"
require "yaml"
require "fileutils"
require "find"
require "time"
require "digest"

# Keep parser diagnostics out of the output (previously in convert-adoc.rb).
Parslet::Logger.instance.level = Logger::FATAL if defined?(Parslet::Logger)

# Object model of the adoc → mirror-json converter.
#
# This file is the library entrypoint: it wires the autoloads and holds
# site-wide constants. Per project rule, internal library files never
# require_relative each other — they reference constants and let
# autoload resolve them.
#
# Class map (all under scripts/convert/):
#   Section          value object over one sections.yml entry; maps its
#                    own source files to output keys and legacy redirects
#   SectionRegistry  loads sections.yml once; lookup by source dir /
#                    output prefix; nav roots; asset/source dir lists
#   SourceFile       one source .adoc: content (read once), frontmatter,
#                    include:: dependency closure, mtime fingerprint
#   NavTitles        memoized _nav.yml reader (titles feed fallbacks)
#   Conversion       outcome of converting one file (data or error)
#   EnvelopeStore    owns mirror-json/: write, prune orphans, manifest
#   Converter        orchestrates the passes, holds stats/errors
#   Rendering        pure per-file pipeline functions (parse/transform)
#   Sources          source collection + asset copying (registry-driven)
#   HubSynthesizer   builds hub-page CoreModel documents
#   PathMapping      section-independent string helpers + SUPERSEDED
module Convert
  SITE_ROOT = File.expand_path("..", __dir__)
  SECTIONS_CONFIG = File.join(SITE_ROOT, "src", "config", "sections.yml")

  lib = File.join(__dir__, "convert")

  autoload :PathMapping, File.join(lib, "path_mapping")
  autoload :Section, File.join(lib, "section")
  autoload :SectionRegistry, File.join(lib, "section_registry")
  autoload :SourceFile, File.join(lib, "source_file")
  autoload :NavTitles, File.join(lib, "nav_titles")
  autoload :Conversion, File.join(lib, "conversion")
  autoload :EnvelopeStore, File.join(lib, "envelope_store")
  autoload :HubSynthesizer, File.join(lib, "hub_synthesizer")
  autoload :Rendering, File.join(lib, "rendering")
  autoload :Sources, File.join(lib, "sources")
  autoload :Converter, File.join(lib, "converter")

  # rewriters.rb defines several constants; all autoload from it.
  autoload :SCHEME_RE, File.join(lib, "rewriters")
  autoload :SiteLinkRewriter, File.join(lib, "rewriters")
  autoload :SiteRootFallbackResolver, File.join(lib, "rewriters")
  autoload :ImagePathNormalizer, File.join(lib, "rewriters")
end
