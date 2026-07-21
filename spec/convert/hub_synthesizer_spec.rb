# frozen_string_literal: true

require "tmpdir"
require "json"

# Specs for Convert::HubSynthesizer (pure CoreModel builder) and the
# source-level hub generation in Convert::Rendering#generate_hub_page
# that feeds it from real directories.
RSpec.describe Convert::HubSynthesizer do
  let(:synth) { Convert::HubSynthesizer }

  def mirror_json_for(core)
    JSON.parse(Coradoc::Mirror.transform(core, partition_structural: true).to_json)
  end

  context "with children" do
    let(:core) do
      synth.build_document(
        title: "Basics",
        children: [{ title: "Workflow", slug: "workflow" }, { title: "Syntax", slug: "syntax" }],
        url_prefix: "author/basics",
      )
    end

    it "builds a document titled after the hub" do
      expect(core.title).to eq("Basics")
    end

    it "records the title in a frontmatter block" do
      fm = core.children.find { |c| c.is_a?(Coradoc::CoreModel::FrontmatterBlock) }
      expect(fm).not_to be_nil
      expect(fm.data["title"]).to eq("Basics")
    end

    it "links every child under /<url_prefix>/<slug>/" do
      list = core.children.find { |c| c.is_a?(Coradoc::CoreModel::ListBlock) }
      expect(list).not_to be_nil
      targets = list.items.map { |item| item.children.first.target }
      expect(targets).to eq(["/author/basics/workflow/", "/author/basics/syntax/"])
    end

    it "renders child titles as link text in the mirror json" do
      json = mirror_json_for(core)
      rendered = JSON.generate(json)
      expect(rendered).to include("Workflow")
      expect(rendered).to include("/author/basics/workflow/")
    end
  end

  context "without children" do
    it "omits the list block" do
      core = synth.build_document(title: "Empty Hub", children: [], url_prefix: "x")
      expect(core.children.none? { |c| c.is_a?(Coradoc::CoreModel::ListBlock) }).to be(true)
    end
  end

  context "with a description" do
    it "adds a leading paragraph with the description" do
      core = synth.build_document(
        title: "Hub", children: [], url_prefix: "x", description: "Intro text.",
      )
      para = core.children.find { |c| c.is_a?(Coradoc::CoreModel::ParagraphBlock) }
      expect(para).not_to be_nil
      expect(para.content).to eq("Intro text.")
    end

    it "treats a blank description as absent" do
      core = synth.build_document(title: "Hub", children: [], url_prefix: "x", description: "  ")
      expect(core.children.none? { |c| c.is_a?(Coradoc::CoreModel::ParagraphBlock) }).to be(true)
    end
  end
end

RSpec.describe "Convert::Rendering.generate_hub_page (source-level hub)" do
  let(:rendering) { Convert::Rendering }

  def generate(adoc_path, output_key, site_root:)
    source_file = Convert::SourceFile.new(path: adoc_path, section: nil, site_root: site_root)
    rendering.generate_hub_page(
      source_file, output_key,
      site_root: site_root, nav: Convert::NavTitles.new(site_root: site_root, err: File.open(File::NULL, "w")),
    )
  end

  it "builds a hub from the child .adoc files of the same-named directory" do
    Dir.mktmpdir do |dir|
      adoc = File.join(dir, "topics.adoc")
      File.write(adoc, "---\ntitle: Topics\n---\n")
      subdir = File.join(dir, "topics")
      Dir.mkdir(subdir)
      File.write(File.join(subdir, "blocks.adoc"), "---\ntitle: Blocks\n---\n\nBody.\n")
      File.write(File.join(subdir, "inline.adoc"), "---\ntitle: Inline\n---\n\nBody.\n")

      result = generate(adoc, "author/topics", site_root: dir)
      expect(result).not_to be_nil
      expect(result[:title]).to eq("Topics")
      expect(result[:mirror_json]).to include("/author/topics/blocks/")
      expect(result[:mirror_json]).to include("/author/topics/inline/")
    end
  end

  it "falls back to the child basename when the child has no title" do
    Dir.mktmpdir do |dir|
      adoc = File.join(dir, "topics.adoc")
      File.write(adoc, "---\ntitle: Topics\n---\n")
      subdir = File.join(dir, "topics")
      Dir.mkdir(subdir)
      File.write(File.join(subdir, "untitled-child.adoc"), "Just a paragraph, no title.\n")

      result = generate(adoc, "author/topics", site_root: dir)
      expect(result[:mirror_json]).to include("/author/topics/untitled-child/")
    end
  end

  it "returns nil when there are no children and no description" do
    Dir.mktmpdir do |dir|
      adoc = File.join(dir, "lonely.adoc")
      File.write(adoc, "---\ntitle: Lonely\n---\n")
      expect(generate(adoc, "author/lonely", site_root: dir)).to be_nil
    end
  end

  it "still builds a page with only a description and no children" do
    Dir.mktmpdir do |dir|
      adoc = File.join(dir, "lonely.adoc")
      File.write(adoc, "---\ntitle: Lonely\ndescription: Words about this section.\n---\n")
      result = generate(adoc, "author/lonely", site_root: dir)
      expect(result).not_to be_nil
      expect(result[:mirror_json]).to include("Words about this section.")
    end
  end
end
