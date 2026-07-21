# frozen_string_literal: true

require "tmpdir"
require "json"

# Specs for Convert::EnvelopeStore — owner of the mirror-json/ tree:
# envelope writing, orphan pruning, and the run manifest.
RSpec.describe Convert::EnvelopeStore do
  def build_doc(title:, children:)
    Coradoc::CoreModel::DocumentElement.build(title: title, children: children)
  end

  def result_for(title, site_root:, source: "author/rt.adoc")
    core = build_doc(title: title, children: [Coradoc::CoreModel::ParagraphBlock.new(content: "body")])
    Convert::Rendering.build_result(
      core, File.join(site_root, source), "author/rt",
      site_root: site_root, nav: Convert::NavTitles.new(site_root: site_root, err: File.open(File::NULL, "w")),
    )
  end

  describe "#write" do
    it "writes a parseable envelope under <dir>/<output_key>.json" do
      Dir.mktmpdir do |dir|
        store = described_class.new(dir)
        result = result_for("Round Trip", site_root: Convert::SITE_ROOT)
        store.write(Convert::Conversion.new(output_key: "author/rt", data: result))

        envelope = JSON.parse(File.read(File.join(dir, "author", "rt.json")))
        expect(envelope["title"]).to eq("Round Trip")
        expect(envelope["source"]).to eq("author/rt.adoc")
        expect(envelope["frontmatter"]).to be_a(Hash)
        expect(envelope["mirror_json"]).to be_a(String)
      end
    end

    it "writes nothing when mirror_json is nil" do
      Dir.mktmpdir do |dir|
        store = described_class.new(dir)
        store.write(Convert::Conversion.new(output_key: "x", data: { mirror_json: nil }))
        expect(File.exist?(File.join(dir, "x.json"))).to be(false)
      end
    end
  end

  describe "#read_manifest / #write_manifest" do
    it "round-trips the manifest" do
      Dir.mktmpdir do |dir|
        store = described_class.new(dir)
        store.write_manifest("stats" => { "ok" => 1 }, "file_map" => { "a" => { "status" => "ok" } })
        expect(store.read_manifest["stats"]).to eq("ok" => 1)
        expect(store.read_file_map).to eq("a" => { "status" => "ok" })
      end
    end

    it "returns {} when the manifest is missing or corrupt" do
      Dir.mktmpdir do |dir|
        store = described_class.new(dir)
        expect(store.read_manifest).to eq({})
        File.write(store.manifest_path, "not json {")
        expect(store.read_manifest).to eq({})
        expect(store.read_file_map).to eq({})
      end
    end
  end

  describe "#prune" do
    it "deletes envelopes outside the valid set, keeping manifest.json" do
      Dir.mktmpdir do |dir|
        store = described_class.new(dir)
        FileUtils.mkdir_p(File.join(dir, "author"))
        File.write(File.join(dir, "author", "keep.json"), "{}")
        File.write(File.join(dir, "author", "stale.json"), "{}")
        File.write(File.join(dir, "toplevel-stale.json"), "{}")
        store.write_manifest("file_map" => {})

        pruned = store.prune(["author/keep"])

        expect(pruned).to contain_exactly("author/stale", "toplevel-stale")
        expect(File.exist?(File.join(dir, "author", "keep.json"))).to be(true)
        expect(File.exist?(File.join(dir, "author", "stale.json"))).to be(false)
        expect(File.exist?(File.join(dir, "toplevel-stale.json"))).to be(false)
        expect(File.exist?(store.manifest_path)).to be(true)
      end
    end

    it "removes directories left empty by pruned envelopes" do
      Dir.mktmpdir do |dir|
        store = described_class.new(dir)
        FileUtils.mkdir_p(File.join(dir, "gone", "deep"))
        File.write(File.join(dir, "gone", "deep", "stale.json"), "{}")
        FileUtils.mkdir_p(File.join(dir, "stays"))
        File.write(File.join(dir, "stays", "keep.json"), "{}")

        store.prune(["stays/keep"])

        expect(File.directory?(File.join(dir, "gone"))).to be(false)
        expect(File.directory?(File.join(dir, "stays"))).to be(true)
      end
    end

    it "ignores non-json files" do
      Dir.mktmpdir do |dir|
        store = described_class.new(dir)
        File.write(File.join(dir, "notes.txt"), "hi")
        expect(store.prune([])).to eq([])
        expect(File.exist?(File.join(dir, "notes.txt"))).to be(true)
      end
    end
  end

  describe "#reset!" do
    it "wipes and recreates the tree" do
      Dir.mktmpdir do |parent|
        dir = File.join(parent, "mirror-json")
        FileUtils.mkdir_p(dir)
        File.write(File.join(dir, "old.json"), "{}")
        store = described_class.new(dir)
        store.reset!
        expect(Dir.children(dir)).to be_empty
      end
    end
  end
end
