# frozen_string_literal: true

require "tmpdir"
require "json"

# Specs for Convert::Rendering — frontmatter parsing, mirror-json
# envelope assembly (build_result), and the per-file convert_file
# pipeline including its error guard. Envelope writing lives in
# Convert::EnvelopeStore (see envelope_store_spec).
RSpec.describe Convert::Rendering do
  let(:rendering) { Convert::Rendering }
  let(:site_root) { Convert::SITE_ROOT }
  let(:nav) { Convert::NavTitles.new(site_root: site_root, err: File.open(File::NULL, "w")) }

  def build_doc(title:, children:)
    Coradoc::CoreModel::DocumentElement.build(title: title, children: children)
  end

  def paragraph(text)
    Coradoc::CoreModel::ParagraphBlock.new(content: text)
  end

  def source_file_for(path, site_root:)
    Convert::SourceFile.new(path: path, section: nil, site_root: site_root)
  end

  describe ".read_frontmatter_data" do
    it "parses valid YAML frontmatter" do
      data = rendering.read_frontmatter_data("---\ntitle: Foo\nlayout: page\n---\n\nBody\n")
      expect(data["title"]).to eq("Foo")
      expect(data["layout"]).to eq("page")
    end

    it "returns {} for malformed YAML" do
      expect { @data = rendering.read_frontmatter_data("---\n{unclosed\n---\nbody\n") }
        .to output(/could not parse frontmatter/).to_stderr
      expect(@data).to eq({})
    end

    it "logs the source path for malformed YAML when given" do
      expect { rendering.read_frontmatter_data("---\n{unclosed\n---\nbody\n", path: "author/x.adoc") }
        .to output(/author\/x\.adoc/).to_stderr
    end

    it "returns {} when there is no frontmatter" do
      expect(rendering.read_frontmatter_data("= Title\n\nBody\n")).to eq({})
    end

    it "returns {} for empty frontmatter markers" do
      expect(rendering.read_frontmatter_data("---\n---\nbody\n")).to eq({})
    end
  end

  describe ".build_result" do
    let(:adoc_path) { File.join(site_root, "author", "some-page.adoc") }

    def build(core, legacy_redirects: [], path: adoc_path)
      rendering.build_result(
        core, path, "author/some-page",
        legacy_redirects: legacy_redirects,
        site_root: site_root, nav: nav,
      )
    end

    it "assembles the envelope fields" do
      result = build(build_doc(title: "Core Title", children: [paragraph("body")]))
      expect(result[:title]).to eq("Core Title")
      expect(result[:mirror_json]).to be_a(String)
      expect(JSON.parse(result[:mirror_json])["type"]).to eq("doc")
      expect(result[:source]).to eq("author/some-page.adoc")
    end

    context "legacy redirect merging" do
      it "adds redirects when no frontmatter block exists" do
        result = build(build_doc(title: "T", children: [paragraph("b")]),
                       legacy_redirects: ["/legacy/"])
        expect(result[:frontmatter]["redirect_from"]).to eq(["/legacy/"])
        expect(result[:frontmatter_yaml]).to include("/legacy/")
      end

      it "merges with existing redirect_from, keeping existing entries first" do
        core = build_doc(title: "T", children: [
          Coradoc::CoreModel::FrontmatterBlock.new(data: { "title" => "T", "redirect_from" => ["/setup/"] }),
          paragraph("b"),
        ])
        result = build(core, legacy_redirects: ["/install/"])
        expect(result[:frontmatter]["redirect_from"]).to eq(["/setup/", "/install/"])
      end

      it "deduplicates redirects present in both frontmatter and legacy" do
        core = build_doc(title: "T", children: [
          Coradoc::CoreModel::FrontmatterBlock.new(data: { "title" => "T", "redirect_from" => ["/setup/"] }),
          paragraph("b"),
        ])
        result = build(core, legacy_redirects: ["/setup/", "/install/"])
        expect(result[:frontmatter]["redirect_from"]).to eq(["/setup/", "/install/"])
      end

      it "leaves redirect_from absent without legacy redirects" do
        result = build(build_doc(title: "T", children: [paragraph("b")]))
        expect(result[:frontmatter]).not_to have_key("redirect_from")
        expect(result[:frontmatter_yaml]).to eq("")
      end
    end

    context "title fallback chain" do
      it "prefers the frontmatter title over the core title" do
        core = build_doc(title: "Core Title", children: [
          Coradoc::CoreModel::FrontmatterBlock.new(data: { "title" => "FM Title" }),
          paragraph("b"),
        ])
        expect(build(core)[:title]).to eq("FM Title")
      end

      it "falls back to the core document title" do
        core = build_doc(title: "Core Title", children: [paragraph("b")])
        expect(build(core)[:title]).to eq("Core Title")
      end

      it "falls back to the _nav.yml title when both titles are empty" do
        # author/basics/_nav.yml declares `file: workflow` → "Workflow".
        core = build_doc(title: "", children: [paragraph("b")])
        result = build(core, path: File.join(site_root, "author", "basics", "workflow.adoc"))
        expect(result[:title]).to eq("Workflow")
      end

      it "falls back to the file basename when nothing else matches" do
        core = build_doc(title: "", children: [paragraph("b")])
        result = build(core, path: File.join(site_root, "no-such-dir-xyzzy", "my-page.adoc"))
        expect(result[:title]).to eq("my-page")
      end
    end
  end

  describe ".convert_file" do
    def convert(adoc_path, output_key, legacy_redirects: [], site_root:)
      rendering.convert_file(
        source_file_for(adoc_path, site_root: site_root), output_key,
        legacy_redirects: legacy_redirects,
        site_root: site_root, nav: Convert::NavTitles.new(site_root: site_root, err: File.open(File::NULL, "w")),
      )
    end

    it "converts a trivial document end to end" do
      Dir.mktmpdir do |dir|
        adoc = File.join(dir, "page.adoc")
        File.write(adoc, "---\ntitle: Spec Page\n---\n\nBody text with link:other.adoc[Other].\n")
        result = convert(adoc, "spec/page", site_root: dir)

        expect(result[:error]).to be_nil
        expect(result[:title]).to eq("Spec Page")
        expect(result[:mirror_json]).to include("Body text")
        # SiteLinkRewriter ran with the file's output key.
        expect(result[:mirror_json]).to include("/spec/other/")
      end
    end

    it "merges legacy redirects into the converted frontmatter" do
      Dir.mktmpdir do |dir|
        adoc = File.join(dir, "page.adoc")
        File.write(adoc, "---\ntitle: Spec Page\n---\n\nBody.\n")
        result = convert(adoc, "spec/page", legacy_redirects: ["/old-page/"], site_root: dir)
        expect(result[:frontmatter]["redirect_from"]).to eq(["/old-page/"])
      end
    end

    it "synthesizes a hub page for an empty-body file with a child directory" do
      Dir.mktmpdir do |dir|
        adoc = File.join(dir, "hub.adoc")
        File.write(adoc, "---\ntitle: Hub\n---\n")
        subdir = File.join(dir, "hub")
        Dir.mkdir(subdir)
        File.write(File.join(subdir, "child-one.adoc"), "---\ntitle: Child One\n---\n\nBody.\n")

        result = convert(adoc, "spec/hub", site_root: dir)
        expect(result[:error]).to be_nil
        expect(result[:title]).to eq("Hub")
        expect(result[:mirror_json]).to include("/spec/hub/child-one/")
      end
    end

    it "synthesizes a placeholder for an empty-body file without children" do
      Dir.mktmpdir do |dir|
        adoc = File.join(dir, "stub.adoc")
        File.write(adoc, "---\ntitle: Stub\n---\n")
        result = convert(adoc, "spec/stub", site_root: dir)
        expect(result[:error]).to be_nil
        expect(result[:title]).to eq("Stub")
        expect(result[:mirror_json]).to include("placeholder")
      end
    end

    # Guards the 1d change: an exception raised AFTER parsing (here inside
    # generate_hub_page → build_result territory) must be captured as a
    # per-file error instead of killing the whole 475-file run.
    it "returns a per-file error when post-parse processing raises" do
      Dir.mktmpdir do |dir|
        adoc = File.join(dir, "hub.adoc")
        File.write(adoc, "---\ntitle: Hub\n---\n")
        subdir = File.join(dir, "hub")
        Dir.mkdir(subdir)
        # A *directory* named *.adoc: Dir.glob picks it up as a hub child,
        # and File.read on it raises Errno::EISDIR during child processing.
        Dir.mkdir(File.join(subdir, "broken.adoc"))

        result = nil
        expect { result = convert(adoc, "spec/hub", site_root: dir) }.not_to raise_error
        expect(result[:error]).to match(/EISDIR|Is a directory/i)
      end
    end
  end
end
