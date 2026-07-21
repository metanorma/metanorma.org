# frozen_string_literal: true

# Specs for Convert::Section — the value object over one sections.yml
# entry. The full mapping/redirect behavior matrix lives in
# section_registry_spec.rb; here are the unit edges.
RSpec.describe Convert::Section do
  def section(**attrs)
    defaults = { id: "x", source_dir: "x", output_prefix: "x", mapping: "tree" }
    described_class.new(**defaults.merge(attrs))
  end

  it "rejects an unknown mapping kind" do
    expect { section(mapping: "bogus") }.to raise_error(ArgumentError, /bogus/)
  end

  describe "#matches?" do
    it "tree sections own their whole subtree" do
      s = section
      expect(s.matches?("x")).to be(true)
      expect(s.matches?("x/y/z")).to be(true)
      expect(s.matches?("xy")).to be(false)
      expect(s.matches?("other")).to be(false)
    end

    it "fixed sections own only their exact dir" do
      s = section(id: "pages", source_dir: "_pages", output_prefix: "", mapping: "fixed")
      expect(s.matches?("_pages")).to be(true)
      expect(s.matches?("_pages/install")).to be(false)
    end

    it "never matches when source_dir is nil (fallback)" do
      expect(described_class.fallback.matches?("anything")).to be(false)
    end
  end

  describe ".fallback" do
    subject(:fallback) { described_class.fallback }

    it "kebabs a generic path" do
      expect(fallback.map_output_path("some_dir", "my_page.adoc")).to eq("some-dir/my-page")
    end

    it "drops the _pages/ prefix like the historic generic rule" do
      expect(fallback.map_output_path("_pages/tools", "my_page.adoc")).to eq("tools/my-page")
    end

    it "strips .html as well as .adoc" do
      expect(fallback.map_output_path("misc", "page.html")).to eq("misc/page")
    end

    it "redirects the source path when the output was kebabed" do
      expect(fallback.legacy_redirects_for("some_dir/my_page.adoc", "some-dir/my-page"))
        .to eq(["/some_dir/my_page/"])
    end

    it "redirects nothing when the production path equals the output key" do
      expect(fallback.legacy_redirects_for("misc/page.adoc", "misc/page")).to eq([])
    end
  end

  describe "attribute readers" do
    it "exposes the sections.yml entry fields with defaults" do
      s = section(nav_root: true, files: { "a.adoc" => "a/index" }, source_extensions: %w[adoc html])
      expect(s.id).to eq("x")
      expect(s.source_dir).to eq("x")
      expect(s.output_prefix).to eq("x")
      expect(s.mapping).to eq("tree")
      expect(s.nav_root?).to be(true)
      expect(s.files).to eq("a.adoc" => "a/index")
      expect(s.source_extensions).to eq(%w[adoc html])
    end

    it "defaults nav_root to false and extensions to adoc" do
      s = section
      expect(s.nav_root?).to be(false)
      expect(s.source_extensions).to eq(%w[adoc])
    end
  end
end
