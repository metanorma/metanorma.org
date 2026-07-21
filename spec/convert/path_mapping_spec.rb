# frozen_string_literal: true

# Specs for Convert::PathMapping — the section-independent string helpers
# (kebab, extension stripping, blog slug/date extraction) and the
# SUPERSEDED table. Output path mapping itself moved to
# Convert::Section / Convert::SectionRegistry (see section_registry_spec).
RSpec.describe Convert::PathMapping do
  let(:pm) { Convert::PathMapping }

  describe ".kebab_segment (THE kebab implementation)" do
    # PARITY: the kebab cases below are duplicated in
    # src/lib/__tests__/kebab.test.ts (TS mirror, src/lib/kebab.ts).
    # Keep the two tables in sync.
    it "converts underscores to dashes" do
      expect(pm.kebab_segment("my_snake_name")).to eq("my-snake-name")
    end

    it "leaves already-kebab strings unchanged" do
      expect(pm.kebab_segment("my-kebab-name")).to eq("my-kebab-name")
    end

    it "preserves case" do
      expect(pm.kebab_segment("YAML_models")).to eq("YAML-models")
    end
  end

  describe ".kebab_path" do
    # PARITY: see the sync note above (src/lib/__tests__/kebab.test.ts).
    it "kebabs every segment of a slash-separated path" do
      expect(pm.kebab_path("a_b/c_d")).to eq("a-b/c-d")
    end

    it "matches kebab_segment for a single segment" do
      expect(pm.kebab_path("a_b")).to eq(pm.kebab_segment("a_b"))
    end
  end

  describe ".strip_adoc_ext / .strip_src_ext" do
    it "strip_adoc_ext strips only .adoc" do
      expect(pm.strip_adoc_ext("page.adoc")).to eq("page")
      expect(pm.strip_adoc_ext("template.html")).to eq("template.html")
    end

    it "strip_src_ext strips .adoc and .html" do
      expect(pm.strip_src_ext("page.adoc")).to eq("page")
      expect(pm.strip_src_ext("template.html")).to eq("template")
    end
  end

  describe ".extract_blog_slug" do
    it "parses a dated post filename" do
      expect(pm.extract_blog_slug("2019-08-24-notes-examples-iso.adoc")).to eq(
        { year: "2019", month: "08", day: "24", slug: "notes-examples-iso" },
      )
    end

    it "returns nil for a filename without a date prefix" do
      expect(pm.extract_blog_slug("no-date-here.adoc")).to be_nil
    end

    it "returns nil for partial dates" do
      expect(pm.extract_blog_slug("2019-08-notes.adoc")).to be_nil
    end
  end

  describe ".filename_date" do
    it "extracts the leading date from a post path" do
      expect(pm.filename_date("_posts/2018-08-24-metanorma-wins-stevie-awards.adoc"))
        .to eq("2018-08-24")
    end

    it "returns nil when the filename has no leading date" do
      expect(pm.filename_date("author/iso.adoc")).to be_nil
    end
  end

  describe "SUPERSEDED" do
    it "is a table of repo-relative source paths to reasons" do
      expect(pm::SUPERSEDED).to be_a(Hash)
      expect(pm::SUPERSEDED).not_to be_empty
      pm::SUPERSEDED.each_key do |rel|
        expect(rel).not_to start_with("/")
      end
    end
  end
end
