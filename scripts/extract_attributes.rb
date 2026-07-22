# frozen_string_literal: true

require "yaml"

# Library for the document-attribute manifest extractor.
#
# Reads the four hand-written attribute reference pages:
#   author/ref/document-attributes.adoc            -> attributes/standoc.yaml
#   flavors/iso/ref/document-attributes.adoc       -> attributes/iso.yaml
#   flavors/ietf/ref/document-attributes.adoc      -> attributes/ietf.yaml
#   flavors/ietf/ref/document-attributes-v2.adoc   -> attributes/ietf-v2.yaml
#
# Design notes
# ------------
# The pages are parsed with coradoc (the only sanctioned AsciiDoc parser in
# this project). The coradoc CoreModel AST is used as a structural
# cross-check of the extraction (entry terms, nested value lists). The
# extraction itself is line-oriented over the raw source, because absolute
# fidelity of prose is a hard requirement and the AST normalizes inline
# markup (smart quotes, anchors, link targets) and, on these pages, drops or
# mis-attributes some constructs (anchors on term lines, the
# `:approval-workgroup::` typo entry, unfenced `[example]` blocks, definition
# lists that escape their section).
#
# Segmentation model (raw lines, validated against the AST):
#   * `== ` headings set the entry `category`; `=== `+ headings set a
#     `subsection` breadcrumb.
#   * A definition-list term line (`` `:name:`:: ``, tolerating missing
#     colons, multi-name terms, `(legacy: ...)` and `(DEPRECATED)` suffixes)
#     opens an attribute entry. The entry owns every line up to the next
#     term line or heading. Colon-less terms (`` `name`:: ``) open entries
#     too: several pages (IEEE, IHO) keep a whole section in one flat `::`
#     list whose terms are sibling attributes. Only boolean-literal terms
#     (`` `true`:: ``/`` `false`:: ``) inside an open entry stay value
#     lines; real value lists use `:::` markers or `--` open blocks.
#   * Within an entry: the dd zone (contiguous lines plus `+` continuation
#     chains) may carry `` `value`::: `` lists, `` `value`:: ``/`` `value`::: ``
#     definition lists inside `--` open blocks (the term's value list), and
#     `[example]` blocks; free blocks after the dd re-attach to the entry
#     description in reading order, except free fenced example blocks,
#     which are section-level and are reported for the hand-written
#     companion pages.
#   * Prose seen before the first entry of a (sub)section is section prose:
#     stored in `sections:` for standoc, reported for the ISO/IETF companion
#     pages. Page-intro prose becomes the manifest `description:`.
#
# Nothing on the source pages is modified by this script.
module ExtractAttributes
  SITE_ROOT = File.expand_path("..", __dir__)
  OUTPUT_DIR = File.join(SITE_ROOT, "attributes")
  REPORT_PATH = File.join(OUTPUT_DIR, "extraction-report.txt")

  # One line per source page. `companion` is the hand-written page that
  # carries non-entry prose (nil for standoc: its prose goes to `sections:`).
  PAGES = {
    "standoc" => {
      flavor: "standoc", label: "Metanorma (all flavors)",
      gem: "metanorma-standoc", inherits_from: nil,
      source: "author/ref/document-attributes.adoc",
      companion: nil, notes: nil,
    },
    "iso" => {
      flavor: "iso", label: "ISO",
      gem: "metanorma-iso", inherits_from: "standoc",
      source: "flavors/iso/ref/document-attributes.adoc",
      companion: "flavors/iso/ref/identifier-patterns.adoc",
      notes: "See /flavors/iso/ref/identifier-patterns/ for identifier " \
             "construction rules, stage-code mappings, and title-component " \
             "guidance.",
    },
    "ietf" => {
      flavor: "ietf", label: "IETF (RFC XML v3)",
      gem: "metanorma-ietf", inherits_from: "standoc",
      source: "flavors/ietf/ref/document-attributes.adoc",
      companion: "flavors/ietf/ref/global-options.adoc",
      notes: "See /author/ietf/ref/global-options/ for header rules, " \
             "author-suffixing conventions, and xml2rfc processing " \
             "instruction guidance.",
    },
    "ietf-v2" => {
      flavor: "ietf-v2", label: "IETF (RFC XML v2)",
      gem: "metanorma-ietf", inherits_from: "standoc",
      source: "flavors/ietf/ref/document-attributes-v2.adoc",
      companion: "flavors/ietf/ref/global-options.adoc",
      notes: "See /author/ietf/ref/global-options/ for header rules, " \
             "author-suffixing conventions, and xml2rfc processing " \
             "instruction guidance.",
    },
    "iec" => {
      flavor: "iec", label: "IEC",
      gem: "metanorma-iec", inherits_from: "standoc",
      source: "flavors/iec/ref/document-attributes.adoc",
      companion: "flavors/iec/ref/notes.adoc",
      notes: "See /flavors/iec/ref/notes/ for stage-code mappings and " \
             "usage notes.",
    },
    "ieee" => {
      flavor: "ieee", label: "IEEE SA",
      gem: "metanorma-ieee", inherits_from: "standoc",
      source: "flavors/ieee/ref/document-attributes.adoc",
      companion: "flavors/ieee/ref/contributors.adoc",
      notes: "See /flavors/ieee/ref/contributors/ for contributor " \
             "metadata guidance.",
    },
    "itu" => {
      flavor: "itu", label: "ITU-T",
      gem: "metanorma-itu", inherits_from: "standoc",
      source: "flavors/itu/ref/document-attributes.adoc",
      companion: "flavors/itu/ref/editorial-groups.adoc",
      notes: "See /flavors/itu/ref/editorial-groups/ for the ITU " \
             "editorial group structure.",
    },
    "jis" => {
      flavor: "jis", label: "JIS",
      gem: "metanorma-jis", inherits_from: "standoc",
      source: "flavors/jis/ref/document-attributes.adoc",
      companion: "flavors/jis/ref/notes.adoc",
      notes: "See /flavors/jis/ref/notes/ for additional guidance.",
    },
    "iho" => {
      flavor: "iho", label: "IHO",
      gem: "metanorma-iho", inherits_from: "standoc",
      source: "flavors/iho/ref/document-attributes.adoc",
      companion: "flavors/iho/ref/notes.adoc",
      notes: "See /flavors/iho/ref/notes/ for additional guidance.",
    },
    "nist" => {
      flavor: "nist", label: "NIST",
      gem: "metanorma-nist", inherits_from: "standoc",
      source: "flavors/nist/ref/document-attributes.adoc",
      companion: "flavors/nist/ref/notes.adoc",
      notes: "See /flavors/nist/ref/notes/ for identifier-composition " \
             "rules, series guidance, and document-relationship conventions.",
    },
    "bsi" => {
      flavor: "bsi", label: "BSI",
      gem: "metanorma-bsi", inherits_from: "standoc",
      source: "flavors/bsi/ref/document-attributes.adoc",
      companion: "flavors/bsi/ref/notes.adoc",
      notes: "See /flavors/bsi/ref/notes/ for document-type lists, " \
             "identifier construction rules, and adoption and commentary " \
             "guidance.",
    },
    "gb" => {
      flavor: "gb", label: "China Standards",
      gem: "metanorma-gb", inherits_from: "standoc",
      source: "flavors/gb/ref/document-attributes.adoc",
      companion: "flavors/gb/ref/notes.adoc",
      notes: "See /flavors/gb/ref/notes/ for title, classification and " \
             "prefix-inference guidance.",
    },
    "plateau" => {
      flavor: "plateau", label: "PLATEAU",
      gem: "metanorma-plateau", inherits_from: "standoc",
      source: "flavors/plateau/ref/document-attributes.adoc",
      companion: "flavors/plateau/ref/notes.adoc",
      notes: "See /flavors/plateau/ref/notes/ for additional guidance.",
    },
    "ogc" => {
      flavor: "ogc", label: "OGC",
      gem: "metanorma-ogc", inherits_from: "standoc",
      source: "flavors/ogc/ref/document-attributes.adoc",
      companion: "flavors/ogc/ref/notes.adoc",
      notes: "See /flavors/ogc/ref/notes/ for legacy document-type " \
             "abbreviations, the White Paper rename, branding schemes, " \
             "and legacy AsciiDoc attribute synonyms.",
    },
    "bipm" => {
      flavor: "bipm", label: "BIPM",
      gem: "metanorma-bipm", inherits_from: "standoc",
      source: "flavors/bipm/ref/document-attributes.adoc",
      companion: "flavors/bipm/ref/notes.adoc",
      notes: "See /flavors/bipm/ref/notes/ for additional guidance.",
    },
  }.freeze

  # Post-extraction corrections from gem validator reviews, kept as DATA
  # (one YAML per flavor in attributes/amendments/) rather than inline
  # Ruby — the runner loads and applies them at extraction time. Each
  # amendment block supports: add_values, notes_update, notes, set, drop
  # (see Runner#apply_amendments and attributes/README.md).
  AMENDMENTS_DIR = File.join(OUTPUT_DIR, "amendments")

  VALIDATOR_AMENDMENTS = Dir.glob(File.join(AMENDMENTS_DIR, "*.yaml")).to_h do |path|
    [File.basename(path, ".yaml"), YAML.safe_load_file(path)]
  end.freeze

  autoload :SourcePage, File.join(__dir__, "extract_attributes", "source_page")
  autoload :Fences, File.join(__dir__, "extract_attributes", "fences")
  autoload :Segmenter, File.join(__dir__, "extract_attributes", "segmenter")
  autoload :TermParser, File.join(__dir__, "extract_attributes", "term_parser")
  autoload :EntryBuilder, File.join(__dir__, "extract_attributes", "entry_builder")
  autoload :Inference, File.join(__dir__, "extract_attributes", "inference")
  autoload :AstCrosscheck, File.join(__dir__, "extract_attributes", "ast_crosscheck")
  autoload :Report, File.join(__dir__, "extract_attributes", "report")
  autoload :Runner, File.join(__dir__, "extract_attributes", "runner")
end
