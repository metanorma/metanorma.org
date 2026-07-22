# frozen_string_literal: true

require "spec_helper"
require "tmpdir"
require "yaml"
require_relative "../../scripts/extract_attributes"

# Specs for the attribute-manifest extractor's mapping logic. Fixtures are
# inline AsciiDoc strings, parsed for real (coradoc + the extractor's own
# pipeline) — no doubles, per project rule.
RSpec.describe ExtractAttributes do
  let(:gem_name) { "metanorma-standoc" }

  def segment(adoc)
    ExtractAttributes::Segmenter.new(adoc.lines(chomp: true))
  end

  def build_entry(adoc, last_in_section: false)
    ev = segment(adoc).events.find { |e| e.type == :entry }
    raise "no entry found in fixture" unless ev

    ExtractAttributes::EntryBuilder.new(
      ev, category: "Test", subsection: nil, gem_name: gem_name,
          last_in_section: last_in_section
    ).build
  end

  describe ExtractAttributes::TermParser do
    it "parses a plain attribute term" do
      info = described_class.analyze("`:docnumber:`::")
      expect(info[:key]).to eq("docnumber")
      expect(info[:other_names]).to eq([])
      expect(info[:legacy]).to eq([])
    end

    it "tolerates a missing trailing colon" do
      expect(described_class.analyze("`:name`::")[:key]).to eq("name")
    end

    it "tolerates names without colons" do
      expect(described_class.analyze("`svg-conform-profile`::")[:key]).to eq("svg-conform-profile")
    end

    it "records the source term when normalizing a typo name" do
      info = described_class.analyze("`:approval-workgroup::`:: The name.")
      expect(info[:key]).to eq("approval-workgroup")
      expect(info[:source_term]).to eq(":approval-workgroup::")
      expect(info[:first_dd_line]).to eq("The name.")
    end

    it "splits alias pairs and marks them non-grouped" do
      info = described_class.analyze("`:status:`, `:docstage:`:: The status.")
      expect(info[:key]).to eq("status")
      expect(info[:other_names]).to eq(["docstage"])
      expect(info[:grouped]).to be false
    end

    it "detects grouped families sharing a hyphenated prefix" do
      info = described_class.analyze(
        "`:sponsor-address{_i}:`, `:sponsor-phone{_i}:`, `:sponsor-fax{_i}:`:: Shared."
      )
      expect(info[:key]).to eq("sponsor-address{_i}")
      expect(info[:other_names]).to eq(%w[sponsor-phone{_i} sponsor-fax{_i}])
      expect(info[:grouped]).to be true
    end

    it "extracts legacy names with and without colons" do
      info = described_class.analyze("`:output-extensions:` (legacy: `:mn-output-extensions:`)::")
      expect(info[:legacy]).to eq(["mn-output-extensions"])
      info = described_class.analyze("`:html-stylesheet:` (legacy: `htmlstylesheet`)::")
      expect(info[:legacy]).to eq(["htmlstylesheet"])
    end

    it "detects the DEPRECATED marker" do
      expect(described_class.analyze("`:scripts-pdf:` (DEPRECATED)::")[:deprecated]).to be true
    end

    it "extracts same-line anchors" do
      info = described_class.analyze("[[stem]] `:stem:`::")
      expect(info[:anchor]).to eq("stem")
      expect(info[:key]).to eq("stem")
    end

    it "detects {_i} and _{n} index markers as repeatable" do
      expect(described_class.repeatable?("publisher{_i}")).to be true
      expect(described_class.repeatable?("technical-committee_{1}")).to be true
      expect(described_class.repeatable?("docnumber")).to be false
    end

    it "distinguishes attribute terms from value lines" do
      expect(described_class.attribute_term?("`:doctype:`::", entry_position: true)).to be true
      expect(described_class.attribute_term?("`true`::: yes", entry_position: true)).to be false
      expect(described_class.attribute_term?("`true`:: yes", entry_position: false)).to be false
      expect(described_class.attribute_term?("`svg-conform-profile`::", entry_position: true)).to be true
      expect(described_class.attribute_term?("`bibtex`::: The format.", entry_position: false)).to be false
    end

    it "treats colon-less terms inside an open entry as sibling attributes" do
      # IEEE/IHO flat `::` lists: every term is an attribute, even when it
      # directly follows another entry or a `:::` value run.
      expect(described_class.attribute_term?("`partnumber`:: The part number.", entry_position: false)).to be true
      expect(described_class.attribute_term?("`docnumber`:: The designation number.", entry_position: false)).to be true
      expect(described_class.attribute_term?("`edition-major`:: The major component.", entry_position: false)).to be true
    end

    it "keeps boolean literal terms inside an open entry as value lines" do
      # standoc pdf-allow-* entries: `true`::/`false`:: are value lines.
      expect(described_class.attribute_term?("`true`:: PDF content can be printed.", entry_position: false)).to be false
      expect(described_class.attribute_term?("`false`:: PDF content cannot be printed.", entry_position: false)).to be false
    end
  end

  describe ExtractAttributes::Segmenter do
    it "tracks sections and entries in order" do
      events = segment(<<~ADOC).events
        Intro paragraph.

        == First

        `:a:`:: Alpha

        === Sub

        `:b:`:: Beta
      ADOC
      types = events.map(&:type)
      expect(types).to eq(%i[intro_prose section entry section entry])
      expect(events[2].term_line).to start_with("`:a:`::")
      expect(events[4].term_line).to start_with("`:b:`::")
    end

    it "skips comment lines, including commented-out pseudo-entries" do
      seg = segment(<<~ADOC)
        == S

        `:a:`:: Alpha

        // `:compact:`::
        // when producing a txt file
      ADOC
      expect(seg.events.count { |e| e.type == :entry }).to eq(1)
      expect(seg.dropped_comments).to eq(2)
    end

    it "does not treat anchors and headings inside fenced blocks as structure" do
      events = segment(<<~ADOC).events
        == S

        `:a:`:: Alpha
        +
        [example]
        ====
        [source,adoc]
        ----
        [[my-anchor]]
        === My title
        ----
        ====
      ADOC
      expect(events.count { |e| e.type == :section }).to eq(1)
      expect(events.count { |e| e.type == :entry }).to eq(1)
    end

    it "attaches a preceding [[anchor]] line to the following term" do
      events = segment(<<~ADOC).events
        == S

        [[my-anchor]]
        `:thing:`:: Stuff
      ADOC
      entry = events.find { |e| e.type == :entry }
      expect(entry.term_line).to include("[[my-anchor]]")
    end

    it "drops a doubled identical term line" do
      seg = segment(<<~ADOC)
        == S

        `:rfcedstyle:`::
        `:rfcedstyle:`::
        attempt to follow style
      ADOC
      expect(seg.events.count { |e| e.type == :entry }).to eq(1)
      expect(seg.dropped_duplicate_terms.size).to eq(1)
    end

    it "opens a new entry for each colon-less term in a flat `::` list" do
      events = segment(<<~ADOC).events
        == Document information

        `docnumber`:: The designation number.

        `partnumber`:: The part number.

        `docstage`:: Document stages. Allowed values are:

        `draft`::: This document is in draft stage.

        `approved`::: (default) This document has been approved.
      ADOC
      entries = events.select { |e| e.type == :entry }
      keys = entries.map { |e| ExtractAttributes::TermParser.analyze(e.term_line)[:key] }
      expect(keys).to eq(%w[docnumber partnumber docstage])
      # The `:::` value run belongs to docstage's body, not to a new entry.
      expect(entries.last.body_lines.join("\n")).to include("`draft`:::")
    end

    it "opens a new entry for a colon-less term following a `:::` value run" do
      events = segment(<<~ADOC).events
        == S

        `:series:`:: Series. Permitted values:

        `B`::: Bathymetric Publications
        `S`::: Standards and Specifications

        `docnumber`:: The designation number.

        `edition`:: The edition number.
        `edition-minor`:: The minor component.
      ADOC
      keys = events.select { |e| e.type == :entry }
                   .map { |e| ExtractAttributes::TermParser.analyze(e.term_line)[:key] }
      expect(keys).to eq(%w[series docnumber edition edition-minor])
    end

    it "keeps `true`/`false` terms inside an open entry as value lines" do
      events = segment(<<~ADOC).events
        == S

        `:pdf-allow-print:`::
        Allow PDF document to be printed.

        `true`:: PDF content can be printed. (default)
        `false`:: PDF content cannot be printed.
      ADOC
      entries = events.select { |e| e.type == :entry }
      expect(entries.size).to eq(1)
      expect(entries.first.body_lines.join("\n")).to include("`true`::")
    end
  end

  describe ExtractAttributes::EntryBuilder do
    it "extracts nested value lists and infers enum" do
      result = build_entry(<<~ADOC)
        `:doctype:`:: Has permitted types:

        `alpha`::: The alpha type.
        `beta`::: The beta type [added in https://github.com/metanorma/metanorma-standoc/releases/tag/v1.2.3]
      ADOC
      entry = result.entry["doctype"]
      expect(entry["type"]).to eq("enum")
      expect(entry["values"].map { |v| v["name"] }).to eq(%w[alpha beta])
      expect(entry["values"][0]["description"]).to eq("The alpha type.")
      expect(entry["values"][1]["added_in"]).to eq("component" => "metanorma-standoc", "version" => "v1.2.3")
      expect(entry["description"]).to eq("Has permitted types:")
    end

    it "extracts bullet-list values introduced by a values line" do
      result = build_entry(<<~ADOC)
        `:status`::
        Set the status. The following values are allowed:
        +
        * `standard`
        * `informational` (mapped in v2 to: `info`)
        +
        RFC XML: `rfc@category`
      ADOC
      entry = result.entry["status"]
      expect(entry["type"]).to eq("enum")
      expect(entry["values"].map { |v| v["name"] }).to eq(%w[standard informational])
      expect(entry["values"][1]["description"]).to eq("(mapped in v2 to: `info`)")
      expect(entry["description"]).to include("RFC XML: `rfc@category`")
    end

    it "strips the entry's own name from bullet tokens" do
      result = build_entry(<<~ADOC)
        `:doctype:`::
        Specifies document status. Choices:
        +
        * `:doctype: internet-draft` sets the document as an Internet-Draft (default value):
        ** detail line
        * `:doctype: rfc` sets the document as an RFC
        +
        Defaults to `internet-draft`.
      ADOC
      entry = result.entry["doctype"]
      expect(entry["values"].map { |v| v["name"] }).to eq(["internet-draft", "rfc"])
      expect(entry["values"][0]["description"]).to include("detail line")
      expect(entry["default"]).to eq("internet-draft")
    end

    it "captures inline 'Allowed values' enumerations without touching prose" do
      result = build_entry(<<~ADOC)
        `:plantuml-image-format:`::
        Format to generate diagrams as. Legal values are `png`, `svg`.
        Defaults to `png`.
      ADOC
      entry = result.entry["plantuml-image-format"]
      expect(entry["values"].map { |v| v["name"] }).to eq(%w[png svg])
      expect(entry["type"]).to eq("enum")
      expect(entry["default"]).to eq("png")
      expect(entry["description"]).to include("Legal values are `png`, `svg`.")
    end

    it "extracts fenced [example] blocks with titles" do
      result = build_entry(<<~ADOC)
        `:docnumber:`:: The number. +
        +
        .Example of setting `:docnumber:`
        [example]
        ====
        For ISO 8601-1:2019, the `docnumber` is `8601`.
        ====
      ADOC
      entry = result.entry["docnumber"]
      expect(entry["example"]).to eq("Example of setting `:docnumber:`\n\nFor ISO 8601-1:2019, the `docnumber` is `8601`.")
      expect(entry["description"]).to eq("The number. +")
    end

    it "extracts unfenced [example] paragraphs" do
      result = build_entry(<<~ADOC)
        `:title-{langcode}:`::
        The title in language `langcode`.
        [example]
        `:title-en:`, `:title-fr:`
      ADOC
      expect(result.entry["title-{langcode}"]["example"]).to eq("`:title-en:`, `:title-fr:`")
    end

    it "extracts bare [source] continuation blocks as examples" do
      result = build_entry(<<~ADOC)
        `:address{_i}:`::
        Postal address.
        +
        [source,asciidoc]
        ----
        :address: Palace
        ----
      ADOC
      entry = result.entry["address{_i}"]
      expect(entry["example"]).to eq(":address: Palace")
      expect(entry["repeatable"]).to be true
    end

    it "keeps [source] blocks inside open-block notes in the description" do
      result = build_entry(<<~ADOC)
        `:pub-address{_i}:`::
        The address. +
        +
        [NOTE]
        --
        Each line must end with `+ \\`, e.g.

        [source,adoc]
        ----
        :pub-address: 1 Infinity Loop
        ----
        --
      ADOC
      entry = result.entry["pub-address{_i}"]
      expect(entry["example"]).to be_nil
      expect(entry["description"]).to include(":pub-address: 1 Infinity Loop")
      expect(entry["description"]).not_to match(/^--$/)
    end

    it "captures added_in macros, first as added_in and rest as version_history" do
      result = build_entry(<<~ADOC)
        `:x:`::
        Does things [added in https://github.com/metanorma/metanorma-standoc/releases/tag/v1.0.0].
        Later more [added in https://github.com/metanorma/metanorma-standoc/releases/tag/v2.0.0].
      ADOC
      entry = result.entry["x"]
      expect(entry["added_in"]).to eq("component" => "metanorma-standoc", "version" => "v1.0.0")
      expect(entry["version_history"]).to eq([{ "component" => "metanorma-standoc", "version" => "v2.0.0" }])
      expect(entry["description"]).not_to include("[added in")
    end

    it "captures multi-line added_in macros" do
      result = build_entry(<<~ADOC)
        `:x:`:: Does things [added in
        https://github.com/metanorma/metanorma-standoc/releases/tag/v1.0.0].
      ADOC
      expect(result.entry["x"]["added_in"]["version"]).to eq("v1.0.0")
    end

    it "emits alias satellites for synonym terms" do
      result = build_entry("`:status:`, `:docstage:`:: The status of the document.")
      expect(result.entry["status"]["aliases"]).to eq(["docstage"])
      expect(result.satellites).to eq([{ "docstage" => { "category" => "Test", "alias_of" => "status" } }])
    end

    it "emits see satellites for grouped terms" do
      result = build_entry("`:sponsor-address{_i}:`, `:sponsor-phone{_i}:`:: The address and phone.")
      expect(result.satellites.first["sponsor-phone{_i}"]["see"]).to eq("sponsor-address{_i}")
      expect(result.satellites.first["sponsor-phone{_i}"]["repeatable"]).to be true
    end

    it "diverts trailing prose of the last entry in a section to spillover" do
      result = build_entry(<<~ADOC, last_in_section: true)
        `:useobject:`::
        when producing a HTML file, use this

        Exceptionally, `compact` is set by default to `yes`.
      ADOC
      expect(result.entry["useobject"]["description"]).to eq("when producing a HTML file, use this")
      expect(result.spillover.join).to include("Exceptionally")
    end

    it "keeps trailing prose with the entry when it has enum values" do
      result = build_entry(<<~ADOC, last_in_section: true)
        `:smartquotes:`::
        Apply smart quotes. Available values below:

        `true`::: (default) quotes are smart

        `false`::: quotes are dumb

        The rules for smart formatting follow the sterile gem.
      ADOC
      expect(result.entry["smartquotes"]["description"]).to include("sterile gem")
      expect(result.spillover).to be_empty
    end

    it "spills free fenced example blocks as section-level material" do
      result = build_entry(<<~ADOC)
        `:publisher:`:: Accepted values are:

        `ISO`::: ISO.

        [example]
        .Setting publishers
        ====
        :publisher: IEC;ISO
        ====
      ADOC
      expect(result.entry["publisher"]["example"]).to be_nil
      expect(result.spillover.join).to include(":publisher: IEC;ISO")
    end

    it "records an anchor only when it differs from the attribute name" do
      result = build_entry("[[stem]] `:stem:`:: The default language.")
      expect(result.entry["stem"]["anchor"]).to be_nil
      result = build_entry("[[fullname]] `:fullname{_i}:`:: The name.")
      expect(result.entry["fullname{_i}"]["anchor"]).to eq("fullname")
    end

    it "extracts value lists from a `--` open block attached to the term" do
      result = build_entry(<<~ADOC)
        `doctype`::
        Document type. Definitions are found in the style manual.
        +
        Choices:
        +
        --
        `standard`:: This document is a Standard (default)
        `recommended-practice`:: This document is a Recommended Practice
        `other`:: This document is of a type not otherwise described
        --
      ADOC
      entry = result.entry["doctype"]
      expect(entry["type"]).to eq("enum")
      expect(entry["values"].map { |v| v["name"] }).to eq(%w[standard recommended-practice other])
      expect(entry["values"][0]["description"]).to eq("This document is a Standard (default)")
      expect(entry["default"]).to eq("standard")
      expect(entry["description"]).to include("Document type.")
      expect(entry["description"]).not_to include("`standard`::")
      expect(entry["description"]).not_to match(/^--$/)
    end

    it "extracts `:::` values from an open block and keeps block prose in the description" do
      result = build_entry(<<~ADOC)
        `:status:`::
        Document status. Choices below.
        +
        --
        `in-force`::: This document is In-force.
        `withdrawn`::: This document has been withdrawn.

        `draft`::: **Do not use this value!**
        +
        NOTE: Use the general `:draft:` attribute instead.

        In general, the document stages are:
        --
      ADOC
      entry = result.entry["status"]
      expect(entry["type"]).to eq("enum")
      expect(entry["values"].map { |v| v["name"] }).to eq(%w[in-force withdrawn draft])
      expect(entry["values"].last["description"]).to include("Use the general `:draft:` attribute instead")
      expect(entry["description"]).to include("In general, the document stages are:")
      expect(entry["description"]).not_to include("in-force`:::")
    end

    it "captures inline italic enumerations without touching prose" do
      result = build_entry(<<~ADOC)
        `balloting-group-type`:: The type of the balloting group,
        _individual_ or _entity_ (default: _individual_).
      ADOC
      entry = result.entry["balloting-group-type"]
      expect(entry["type"]).to eq("enum")
      expect(entry["values"].map { |v| v["name"] }).to eq(%w[individual entity])
      expect(entry["default"]).to eq("individual")
      expect(entry["description"]).to include("_individual_ or _entity_")
    end
  end

  describe ExtractAttributes::Inference do
    it "infers types in priority order" do
      expect(described_class.infer_type("a", "comma-delimited list of x", [])).to eq("comma-list")
      expect(described_class.infer_type("a", "comma-delimited list", [{ "name" => "x" }])).to eq("comma-list")
      expect(described_class.infer_type("a", "plain", [{ "name" => "x" }])).to eq("enum")
      expect(described_class.infer_type("a", "Allowed values: `true`, `false`.", [])).to eq("boolean")
      expect(described_class.infer_type("a", "If set, do not index.", [])).to eq("boolean")
      expect(described_class.infer_type("a", "Accepts an integer value.", [])).to eq("integer")
      expect(described_class.infer_type("xml-uri", "The URI.", [])).to eq("uri")
      expect(described_class.infer_type("published-date", "Accepts ISO 8601 date.", [])).to eq("date")
      expect(described_class.infer_type("docnumber", "The number.", [])).to eq("string")
    end

    it "extracts defaults from prose and value markers" do
      expect(described_class.extract_default("Defaults to `png`.", [])).to eq("png")
      expect(described_class.extract_default("Default value `true`.", [])).to eq("true")
      expect(described_class.extract_default("(default: `2`)", [])).to eq("2")
      expect(described_class.extract_default("By default this is `en`.", [])).to eq("en")
      marked = [{ "name" => "2024", "description" => "(default) Latest layout" }]
      expect(described_class.extract_default("Options are:", marked)).to eq("2024")
      expect(described_class.extract_default("Default value is current date.", [])).to be_nil
    end

    it "detects required only from explicit mandatory/required statements" do
      expect(described_class.required?("Mandatory. Title of document.")).to be true
      expect(described_class.required?("(mandatory). Permitted types are:")).to be true
      expect(described_class.required?("Avoid it. " * 20 + "as is required by ISO.")).to be false
      expect(described_class.required?("Optional. Things.")).to be false
    end

    it "extracts bare [added in vX] macros with the page gem as component" do
      stripped, found = described_class.extract_added_in("Things [added in v1.2.3].", "metanorma-iso")
      expect(found).to eq([{ "component" => "metanorma-iso", "version" => "v1.2.3" }])
      expect(stripped).to eq("Things.")
    end
  end

  describe ExtractAttributes::SourcePage do
    it "splits frontmatter and parses the body with coradoc" do
      Dir.mktmpdir do |dir|
        path = File.join(dir, "page.adoc")
        File.write(path, "---\nlayout: x\n---\n\n== Section\n\n`:a:`:: Alpha\n")
        page = described_class.new(path)
        expect(page.frontmatter).to include("layout: x")
        expect(page.body_lines.first).to eq("")
        # coradoc really parsed the body: the AST knows the definition item
        items = ExtractAttributes::AstCrosscheck.new(page.document)
        expect(items.collect_items(page.document, []).map(&:key)).to include("a")
      end
    end
  end

  describe ExtractAttributes::AstCrosscheck do
    it "compares extracted keys against the coradoc AST" do
      adoc = "== S\n\n`:a:`:: Alpha\n\n`v1`::: one\n`v2`::: two\n\n`:b:`:: Beta\n"
      doc = Coradoc.parse(adoc, format: :asciidoc)
      check = described_class.new(doc)
      expect(check.compare(%w[a b], { "a" => %w[v1 v2] })).to eq([])
      diffs = check.compare(%w[a], { "a" => %w[v1] })
      expect(diffs.join).to include("only in coradoc AST")
      expect(diffs.join).to include("v2")
    end
  end

  describe ExtractAttributes::Runner do
    it "extracts a full page end-to-end into a YAML manifest" do
      Dir.mktmpdir do |dir|
        page_path = File.join(dir, "page.adoc")
        File.write(page_path, <<~ADOC)
          ---
          layout: x
          ---

          Intro prose line.

          == Build

          Section prose line.

          `:imagesdir:`::
          (Optional) Directory in which images are located.

          `:output-extensions:` (legacy: `:mn-output-extensions:`)::
          The output formats, comma-delimited; e.g. `xml,html`.

          == Document information

          `:status:`, `:docstage:`:: The status of the document.
        ADOC
        config = {
          flavor: "test", label: "Test", gem: "metanorma-standoc",
          inherits_from: nil, source: page_path, companion: nil, notes: nil,
        }
        out = StringIO.new
        described_class.new(out: out, output_dir: dir).run(["test"], pages: { "test" => config })
        data = YAML.safe_load_file(File.join(dir, "test.yaml"))

        expect(data["flavor"]).to eq("test")
        expect(data["description"]).to eq("Intro prose line.")
        expect(data["sections"].first["prose"]).to eq("Section prose line.")
        attrs = data["attributes"]
        expect(attrs["imagesdir"]["category"]).to eq("Build")
        expect(attrs["output-extensions"]["type"]).to eq("comma-list")
        expect(attrs["output-extensions"]["legacy"]).to eq(["mn-output-extensions"])
        expect(attrs["status"]["aliases"]).to eq(["docstage"])
        expect(attrs["docstage"]["alias_of"]).to eq("status")
        expect(File.read(File.join(dir, "extraction-report.txt"))).to include("## test")
      end
    end

    it "keeps flat-list sibling attributes separate on an IEEE-style page" do
      Dir.mktmpdir do |dir|
        page_path = File.join(dir, "page.adoc")
        File.write(page_path, <<~ADOC)
          ---
          layout: x
          ---

          == Document information

          `docnumber`:: The designation number. Do not include the initial "P".

          `docstage`:: Document stages. Allowed values are:

          `draft`::: This document is in draft stage.

          `approved`::: (default) This document has been approved.

          `doctype`::
          Document type.
          +
          Choices:
          +
          --
          `standard`:: This document is a Standard (default)
          `guide`:: This document is a Guide
          --

          `ieee-sasb-approved-date`:: Date approved by the Board [added in https://github.com/metanorma/metanorma-ieee/releases/tag/v1.5.3].

          `balloting-group`:: The balloting group responsible for the document.

          `balloting-group-type`:: The type of the balloting group,
          _individual_ or _entity_ (default: _individual_).
        ADOC
        config = {
          flavor: "test", label: "Test", gem: "metanorma-ieee",
          inherits_from: "standoc", source: page_path, companion: nil, notes: nil,
        }
        described_class.new(out: StringIO.new, output_dir: dir).run(["test"], pages: { "test" => config })
        attrs = YAML.safe_load_file(File.join(dir, "test.yaml"))["attributes"]

        expect(attrs["docnumber"]["type"]).to eq("string")
        expect(attrs["docnumber"]["values"]).to be_nil
        expect(attrs["docnumber"]["default"]).to be_nil
        expect(attrs["docstage"]["type"]).to eq("enum")
        expect(attrs["docstage"]["values"].map { |v| v["name"] }).to eq(%w[draft approved])
        expect(attrs["docstage"]["default"]).to eq("approved")
        expect(attrs["doctype"]["type"]).to eq("enum")
        expect(attrs["doctype"]["values"].map { |v| v["name"] }).to eq(%w[standard guide])
        expect(attrs["doctype"]["default"]).to eq("standard")
        expect(attrs["ieee-sasb-approved-date"]["added_in"]).to eq(
          "component" => "metanorma-ieee", "version" => "v1.5.3"
        )
        expect(attrs["balloting-group"]["values"]).to be_nil
        expect(attrs["balloting-group-type"]["type"]).to eq("enum")
        expect(attrs["balloting-group-type"]["values"].map { |v| v["name"] }).to eq(%w[individual entity])
      end
    end

    it "keeps colon-less terms after `:::` value runs as top-level entries on an IHO-style page" do
      Dir.mktmpdir do |dir|
        page_path = File.join(dir, "page.adoc")
        File.write(page_path, <<~ADOC)
          ---
          layout: x
          ---

          == Document information

          `:series:`:: Series that the document belongs to. Permitted values:

          `B`::: Bathymetric Publications
          `S`::: Standards and Specifications

          `docnumber`:: The designation number for the document.

          `:status:`:: Document status. Permitted types:

          `in-force`::: Document is in-force.
          `retired`::: Document has been retired.

          `edition`:: The edition number of the document.

          `edition-major`:: The major component [added in https://github.com/metanorma/metanorma-iho/releases/tag/v0.7.4].
          `edition-minor`:: The minor component [added in https://github.com/metanorma/metanorma-iho/releases/tag/v0.7.4].
        ADOC
        config = {
          flavor: "test", label: "Test", gem: "metanorma-iho",
          inherits_from: "standoc", source: page_path, companion: nil, notes: nil,
        }
        described_class.new(out: StringIO.new, output_dir: dir).run(["test"], pages: { "test" => config })
        attrs = YAML.safe_load_file(File.join(dir, "test.yaml"))["attributes"]

        expect(attrs["series"]["values"].map { |v| v["name"] }).to eq(%w[B S])
        expect(attrs["status"]["values"].map { |v| v["name"] }).to eq(%w[in-force retired])
        expect(attrs["docnumber"]["type"]).to eq("string")
        expect(attrs["docnumber"]["values"]).to be_nil
        expect(attrs["edition"]["description"]).to include("edition number")
        expect(attrs["edition-major"]["added_in"]).to eq(
          "component" => "metanorma-iho", "version" => "v0.7.4"
        )
        expect(attrs["edition-minor"]["description"]).to include("minor component")
      end
    end

    describe "validator amendments" do
      def run_with_amendments(amendments)
        Dir.mktmpdir do |dir|
          page_path = File.join(dir, "page.adoc")
          File.write(page_path, <<~ADOC)
            ---
            layout: x
            ---

            == Document information

            `:docnumber:`:: The designation number.
          ADOC
          config = {
            flavor: "test", label: "Test", gem: "metanorma-x",
            inherits_from: "standoc", source: page_path, companion: nil, notes: nil,
          }
          ExtractAttributes::Runner.new(out: StringIO.new, output_dir: dir)
                                   .run(["test"], pages: { "test" => config },
                                                  amendments: { "test" => amendments })
          YAML.safe_load_file(File.join(dir, "test.yaml"))["attributes"]
        end
      end

      it "creates entries for amendments naming attributes absent from the manifest" do
        attrs = run_with_amendments(
          "doctype" => {
            "category" => "Document information",
            "add_values" => [
              { "name" => "standard", "description" => "A standard." },
              { "name" => "guide", "description" => "A guide." },
            ],
            "notes" => "Accepted by the gem validator but not documented.",
          }
        )
        entry = attrs["doctype"]
        expect(entry).not_to be_nil
        expect(entry["category"]).to eq("Document information")
        expect(entry["type"]).to eq("enum")
        expect(entry["values"].map { |v| v["name"] }).to eq(%w[standard guide])
        expect(entry["notes"]).to eq("Accepted by the gem validator but not documented.")
      end

      it "falls back to the manifest's first category when the amendment has none" do
        attrs = run_with_amendments(
          "docstage" => { "add_values" => [{ "name" => "60" }] }
        )
        expect(attrs["docstage"]["category"]).to eq("Document information")
        expect(attrs["docstage"]["values"].map { |v| v["name"] }).to eq(["60"])
      end

      it "still merges amendments into existing extracted entries" do
        attrs = run_with_amendments(
          "docnumber" => {
            "add_values" => [{ "name" => "special", "notes" => "From gem validation." }],
            "notes" => "Cross-checked.",
          }
        )
        entry = attrs["docnumber"]
        expect(entry["type"]).to eq("enum")
        expect(entry["values"].map { |v| v["name"] }).to eq(["special"])
        expect(entry["notes"]).to eq("Cross-checked.")
        expect(entry["description"]).to eq("The designation number.")
      end
    end
  end
end
