# frozen_string_literal: true

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
#     term line or heading.
#   * Within an entry: the dd zone (contiguous lines plus `+` continuation
#     chains) may carry `` `value`::: `` lists and `[example]` blocks; free
#     blocks after the dd re-attach to the entry description in reading
#     order, except free fenced example blocks, which are section-level and
#     are reported for the hand-written companion pages.
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
  }.freeze

  # Post-extraction corrections from the gem validator review (see
  # attributes/extraction-report.txt for the full table). Each added value
  # cites its evidence in `notes`.
  VALIDATOR_AMENDMENTS = {
    "iso" => {
      "doctype" => {
        "add_values" => [
          { "name" => "recommendation",
            "description" => "Recommendation (Rec)",
            "notes" => "Accepted by the current metanorma-iso validator " \
                       "(lib/metanorma/iso/validate.rb doctype_validate) and " \
                       "mapped in lib/metanorma/iso/front_id.rb " \
                       "DOCTYPE2HASHID, but not documented on the source page." },
        ],
      },
      "document-scheme" => {
        "add_values" => [
          { "name" => "1979",
            "description" => "Document layout used from 1979 to 1987.",
            "notes" => "Accepted by the current metanorma-iso converter " \
                       "(lib/metanorma/iso/base.rb DOCUMENT_SCHEMES) but not " \
                       "documented on the source page." },
        ],
      },
      "docstage" => {
        "add_values" => [
          { "name" => "00", "description" => "Preliminary stage (PWI)." },
          { "name" => "10", "description" => "Proposal stage (NP, AWI)." },
          { "name" => "20", "description" => "Preparatory stage (WD)." },
          { "name" => "30", "description" => "Committee stage (CD)." },
          { "name" => "40", "description" => "Enquiry stage (DIS)." },
          { "name" => "50", "description" => "Approval stage (FDIS)." },
          { "name" => "60",
            "description" => "Publication stage (`60.00` is the PRF proof, " \
                             "`60.60` the published document)." },
          { "name" => "90", "description" => "Review stage.",
            "notes" => "Enumerated by the isostandard.rnc schema but not " \
                       "described on the source page." },
          { "name" => "95", "description" => "Withdrawal stage.",
            "notes" => "Enumerated by the isostandard.rnc schema but not " \
                       "described on the source page." },
        ],
        "notes" => "Stage-code value set cross-checked against the " \
                   "isostandard.rnc schema enum (00/10/20/30/40/50/60/90/95).",
      },
      "docsubstage" => {
        "add_values" => [
          { "name" => "00",
            "description" => "Assumed substage when omitted (except at stage " \
                             "`60`)." },
          { "name" => "20", "description" => "Substage 20.",
            "notes" => "Enumerated by the isostandard.rnc schema but not " \
                       "described on the source page." },
          { "name" => "60",
            "description" => "Assumed substage at stage `60` (`60.00` = PRF " \
                             "proof, `60.60` = published)." },
          { "name" => "90", "description" => "Substage 90.",
            "notes" => "Enumerated by the isostandard.rnc schema but not " \
                       "described on the source page." },
          { "name" => "92", "description" => "Substage 92.",
            "notes" => "Enumerated by the isostandard.rnc schema but not " \
                       "described on the source page." },
          { "name" => "93", "description" => "Substage 93.",
            "notes" => "Enumerated by the isostandard.rnc schema but not " \
                       "described on the source page." },
          { "name" => "98", "description" => "Substage 98.",
            "notes" => "Enumerated by the isostandard.rnc schema but not " \
                       "described on the source page." },
          { "name" => "99", "description" => "Substage 99.",
            "notes" => "Enumerated by the isostandard.rnc schema but not " \
                       "described on the source page." },
        ],
        "notes" => "Substage value set cross-checked against the " \
                   "isostandard.rnc schema enum (00/20/60/90/92/93/98/99).",
      },
    },
  }.freeze

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
