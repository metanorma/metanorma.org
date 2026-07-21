# frozen_string_literal: true

# Specs for the post-parse rewriters that fix up link targets and image
# sources for the clean-URL restructure. These run inside convert_file
# for every one of the ~475 source files; they decide what every
# internal href on the rendered site looks like.
RSpec.describe Convert::SiteLinkRewriter do
  # output_key "author/iso/authoring" → sibling-relative targets resolve
  # against the parent output dir "/author/iso".
  let(:rewriter) { described_class.new(source_output_key: "author/iso/authoring") }

  def rewrite(target, kind: :link)
    rewriter.call(target: target, kind: kind, context: nil)
  end

  context "URLs that must pass through untouched" do
    it "skips http(s) URLs" do
      expect(rewrite("https://example.com/page")).to eq("https://example.com/page")
      expect(rewrite("http://example.com/page")).to eq("http://example.com/page")
    end

    it "skips other schemes" do
      expect(rewrite("mailto:info@example.com")).to eq("mailto:info@example.com")
      expect(rewrite("ftp://example.com/f")).to eq("ftp://example.com/f")
      expect(rewrite("data:image/png;base64,AAAA")).to eq("data:image/png;base64,AAAA")
    end

    it "skips protocol-relative URLs" do
      expect(rewrite("//cdn.example.com/x.js")).to eq("//cdn.example.com/x.js")
    end
  end

  context "in-page anchors" do
    it "leaves bare xref anchors unchanged" do
      expect(rewrite("anchor-name", kind: :xref)).to eq("anchor-name")
    end

    it "leaves underscore anchors unchanged (no kebabing)" do
      expect(rewrite("anchor_name", kind: :xref)).to eq("anchor_name")
    end

    it "rebased link-kind bare targets as sibling pages (only :xref is anchor-safe)" do
      expect(rewrite("anchor-name", kind: :link)).to eq("/author/iso/anchor-name/")
    end

    it "does not treat a target containing a dot as an in-page anchor" do
      expect(rewrite("page.adoc", kind: :xref)).to eq("/author/iso/page/")
    end

    it "rebases xrefs that carry a fragment, preserving the fragment" do
      expect(rewrite("other-page.adoc#sec", kind: :xref)).to eq("/author/iso/other-page/#sec")
    end

    it "current behavior: a bare #fragment xref is rebased to the page's own dir" do
      # pure_in_page_anchor? returns false when a fragment is present, so
      # the empty path resolves to the output directory itself.
      expect(rewrite("#sec", kind: :xref)).to eq("/author/iso/#sec")
    end
  end

  context "blog legacy URL forms" do
    it "rewrites the DD-MM-YYYY form to the date-prefixed slug" do
      expect(rewrite("/blog/08-24-2018/metanorma-wins-stevie-awards/"))
        .to eq("/blog/2018-08-24-metanorma-wins-stevie-awards/")
    end

    it "rewrites the Jekyll YYYY/MM/DD form" do
      expect(rewrite("/blog/2018/08/24/metanorma-wins-stevie-awards/"))
        .to eq("/blog/2018-08-24-metanorma-wins-stevie-awards/")
    end

    it "preserves a fragment on legacy forms" do
      expect(rewrite("/blog/08-24-2018/some-post/#comments"))
        .to eq("/blog/2018-08-24-some-post/#comments")
    end

    it "does not rewrite relative blog paths (regex requires a leading segment)" do
      expect(rewrite("blog/08-24-2018/some-post/", kind: :link))
        .to eq("/author/iso/blog/08-24-2018/some-post/")
    end
  end

  context "path normalization" do
    it "kebabs snake_case segments" do
      expect(rewrite("/author/my_page/next_page.adoc")).to eq("/author/my-page/next-page/")
    end

    it "strips the .adoc extension" do
      expect(rewrite("/author/iso/sample.adoc")).to eq("/author/iso/sample/")
    end

    it "adds a trailing slash to bare absolute paths" do
      expect(rewrite("/author/iso")).to eq("/author/iso/")
    end

    it "keeps an existing trailing slash" do
      expect(rewrite("/already/slashed/")).to eq("/already/slashed/")
    end

    it "preserves a fragment while adding the trailing slash" do
      expect(rewrite("/page#frag")).to eq("/page/#frag")
    end

    it "preserves both a trailing slash and a fragment" do
      expect(rewrite("/page/#frag")).to eq("/page/#frag")
    end
  end

  context "sibling-relative rebasing" do
    it "resolves sibling files against the source file's output directory" do
      expect(rewrite("images.adoc")).to eq("/author/iso/images/")
    end

    it "resolves deeper relative paths" do
      expect(rewrite("topics/blocks.adoc")).to eq("/author/iso/topics/blocks/")
    end

    it "expands .. against the output directory" do
      expect(rewrite("../basics/workflow.adoc")).to eq("/author/basics/workflow/")
    end

    it "expands multiple .. segments" do
      expect(rewrite("../../develop/setup.adoc")).to eq("/develop/setup/")
    end
  end

  context "with a top-level output key" do
    let(:rewriter) { described_class.new(source_output_key: "install/index") }

    it "rebases against the first-level directory" do
      expect(rewrite("linux.adoc")).to eq("/install/linux/")
    end
  end
end

RSpec.describe Convert::ImagePathNormalizer do
  let(:normalizer) { described_class.new(source_output_key: "author/iso/authoring") }

  def normalized_src(src)
    image = Coradoc::CoreModel::Image.new(src: src)
    doc = Coradoc::CoreModel::DocumentElement.build(title: "T", children: [image])
    normalizer.normalize!(doc)
    image.src
  end

  it "rebases relative image paths against the output directory" do
    expect(normalized_src("images/diagram.png")).to eq("/author/iso/images/diagram.png")
  end

  it "rebases bare filenames" do
    expect(normalized_src("diagram.png")).to eq("/author/iso/diagram.png")
  end

  it "leaves absolute paths unchanged" do
    expect(normalized_src("/assets/blog/x.png")).to eq("/assets/blog/x.png")
  end

  it "leaves scheme URLs unchanged" do
    expect(normalized_src("https://example.com/x.png")).to eq("https://example.com/x.png")
  end

  it "leaves protocol-relative URLs unchanged" do
    expect(normalized_src("//cdn.example.com/x.png")).to eq("//cdn.example.com/x.png")
  end

  it "leaves empty srcs unchanged" do
    expect(normalized_src("")).to eq("")
  end

  it "reaches images nested inside container elements" do
    image = Coradoc::CoreModel::Image.new(src: "nested.png")
    section = Coradoc::CoreModel::SectionElement.new(title: "Sec", children: [image])
    doc = Coradoc::CoreModel::DocumentElement.build(title: "T", children: [section])
    normalizer.normalize!(doc)
    expect(image.src).to eq("/author/iso/nested.png")
  end

  it "rebases relative to a first-level output directory" do
    normalizer = described_class.new(source_output_key: "install/index")
    image = Coradoc::CoreModel::Image.new(src: "screenshot.png")
    doc = Coradoc::CoreModel::DocumentElement.build(title: "T", children: [image])
    normalizer.normalize!(doc)
    expect(image.src).to eq("/install/screenshot.png")
  end
end

RSpec.describe "Convert.resolve_against_output_dir" do
  it "returns absolute paths unchanged" do
    expect(Convert.resolve_against_output_dir("/x/y", "a/b")).to eq("/x/y")
  end

  it "returns the path unchanged when the output key is nil or empty" do
    expect(Convert.resolve_against_output_dir("x.png", nil)).to eq("x.png")
    expect(Convert.resolve_against_output_dir("x.png", "")).to eq("x.png")
  end

  it "resolves against the parent directory of the output key" do
    expect(Convert.resolve_against_output_dir("x.png", "author/iso/page")).to eq("/author/iso/x.png")
  end

  it "returns the path unchanged when the output key has no parent" do
    expect(Convert.resolve_against_output_dir("x.png", "toplevel")).to eq("x.png")
  end
end
