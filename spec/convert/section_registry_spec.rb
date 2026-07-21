# frozen_string_literal: true

# Specs for Convert::SectionRegistry — the single source of truth for
# section knowledge, loaded from src/config/sections.yml. The mapping and
# redirect behavior matrix below is preserved 1:1 from the old
# Convert::PathMapping table specs: any behavior change here changes
# public URLs, so each branch is pinned down explicitly.
RSpec.describe Convert::SectionRegistry do
  subject(:registry) { described_class.load }

  describe ".load from the real src/config/sections.yml" do
    it "loads every section with its declared attributes" do
      by_id = registry.to_a.group_by(&:id).transform_values(&:first)

      expect(by_id.keys).to contain_exactly(
        "author", "flavors", "develop", "learn", "software", "specs",
        "blog", "install", "pages", "reference",
      )
      expect(by_id["blog"].source_dir).to eq("_posts")
      expect(by_id["blog"].output_prefix).to eq("blog")
      expect(by_id["blog"].mapping).to eq("date_prefix")
      expect(by_id["install"].source_dir).to eq("_pages/install")
      expect(by_id["pages"].source_extensions).to eq(%w[adoc html])
      expect(by_id["reference"].mapping).to eq("ref_strip")
    end

    it "marks exactly the seven content hubs as nav roots" do
      expect(registry.nav_roots.map(&:id)).to eq(
        %w[author flavors develop learn software specs install],
      )
    end

    it "derives top-level source dirs (nested section dirs collapse)" do
      expect(registry.top_level_source_dirs).to contain_exactly(
        "author", "flavors", "develop", "learn", "software", "specs",
        "_posts", "_pages", "reference_docs",
      )
    end

    it "derives source extensions per top-level dir" do
      expect(registry.source_extensions_under("_pages")).to contain_exactly("adoc", "html")
      expect(registry.source_extensions_under("author")).to eq(%w[adoc])
    end
  end

  describe "#for_source_dir" do
    it "returns the section whose source_dir matches exactly" do
      expect(registry.for_source_dir("_posts").id).to eq("blog")
      expect(registry.for_source_dir("author").id).to eq("author")
    end

    it "returns the owning tree section for nested dirs" do
      expect(registry.for_source_dir("author/topics/blocks").id).to eq("author")
      expect(registry.for_source_dir("_pages/install").id).to eq("install")
    end

    it "does not match files under a non-recursive section's dir" do
      expect(registry.for_source_dir("_posts/2024")).to be_nil
      expect(registry.for_source_dir("reference_docs/YAML_models")).to be_nil
    end

    it "returns nil for unknown dirs" do
      expect(registry.for_source_dir("nowhere")).to be_nil
    end
  end

  describe "#for_output_prefix" do
    it "finds sections by their output prefix" do
      expect(registry.for_output_prefix("blog").id).to eq("blog")
      expect(registry.for_output_prefix("reference").id).to eq("reference")
      expect(registry.for_output_prefix("nope")).to be_nil
    end
  end

  describe "#source_dir_for_output" do
    it "identity-maps tree section prefixes" do
      expect(registry.source_dir_for_output("author/iso/topics")).to eq("author/iso/topics")
      expect(registry.source_dir_for_output("flavors/iso")).to eq("flavors/iso")
    end

    it "keeps the first segment for non-tree sections" do
      expect(registry.source_dir_for_output("blog")).to eq("blog")
      expect(registry.source_dir_for_output("reference")).to eq("reference")
    end
  end

  describe "#map_output_path" do
    context "_pages fixed map" do
      {
        "install.adoc" => "install/index",
        "author.adoc" => "author/index",
        "develop.adoc" => "develop/index",
        "learn.adoc" => "learn/index",
        "contribute.adoc" => "contribute/index",
        "reference_docs.adoc" => "reference/index",
      }.each do |filename, expected|
        it "maps #{filename} to #{expected}" do
          expect(registry.map_output_path("_pages", filename)).to eq(expected)
        end
      end

      it "returns nil for a _pages file with no map entry" do
        expect(registry.map_output_path("_pages", "flavors.adoc")).to be_nil
      end
    end

    context "_posts date-prefix mapping" do
      it "maps a dated post to blog/YYYY-MM-DD-slug" do
        expect(registry.map_output_path("_posts", "2018-08-24-metanorma-wins-stevie-awards.adoc"))
          .to eq("blog/2018-08-24-metanorma-wins-stevie-awards")
      end

      it "returns nil for a post filename without a date prefix" do
        expect(registry.map_output_path("_posts", "draft-post.adoc")).to be_nil
      end
    end

    context "_pages/<subdir> prefix mapping" do
      it "maps _pages/install files under install/" do
        expect(registry.map_output_path("_pages/install", "linux.adoc")).to eq("install/linux")
      end

      it "kebabs snake_case filenames" do
        expect(registry.map_output_path("_pages/install", "cicd_github.adoc")).to eq("install/cicd-github")
      end

      it "strips .html as well as .adoc" do
        expect(registry.map_output_path("_pages/install", "template.html")).to eq("install/template")
      end

      it "kebabs nested subdirectories of _pages via the fallback" do
        expect(registry.map_output_path("_pages/deep_dir/deeper_dir", "some_page.adoc"))
          .to eq("deep-dir/deeper-dir/some-page")
      end
    end

    context "reference_docs Ref- stripping" do
      it "strips the Ref- prefix and downcases" do
        expect(registry.map_output_path("reference_docs", "Ref-ISO-Document-Attributes.adoc"))
          .to eq("reference/iso-document-attributes")
      end

      it "kebabs underscores after downcasing" do
        expect(registry.map_output_path("reference_docs", "Ref-standoc_attributes.adoc"))
          .to eq("reference/standoc-attributes")
      end

      it "handles files without the Ref- prefix" do
        expect(registry.map_output_path("reference_docs", "plain.adoc")).to eq("reference/plain")
      end
    end

    context "tree top-level directories" do
      {
        "author" => "author/iso",
        "flavors" => "flavors/iso",
        "develop" => "develop/iso",
        "learn" => "learn/iso",
        "software" => "software/iso",
        "specs" => "specs/iso",
      }.each do |src_dir, expected|
        it "maps #{src_dir}/iso.adoc to #{expected}" do
          expect(registry.map_output_path(src_dir, "iso.adoc")).to eq(expected)
        end
      end

      it "kebabs the filename" do
        expect(registry.map_output_path("software", "metanorma_iso.adoc")).to eq("software/metanorma-iso")
      end
    end

    context "tree nested directories" do
      it "maps one level of nesting" do
        expect(registry.map_output_path("author/iso", "authoring.adoc")).to eq("author/iso/authoring")
      end

      it "maps multiple levels of nesting" do
        expect(registry.map_output_path("flavors/iso/topics/blocks", "my_topic.adoc"))
          .to eq("flavors/iso/topics/blocks/my-topic")
      end

      it "kebabs snake_case subdirectory segments" do
        expect(registry.map_output_path("learn/exercises_code", "exercise_one.adoc"))
          .to eq("learn/exercises-code/exercise-one")
      end

      it "does not strip .html in tree branches (only .adoc)" do
        expect(registry.map_output_path("learn", "template.html")).to eq("learn/template.html")
      end
    end

    context "fallback (no section claims the dir)" do
      it "maps unknown top-level dirs generically" do
        expect(registry.map_output_path("unknown_dir", "some_file.adoc")).to eq("unknown-dir/some-file")
      end

      it "strips .html in the fallback" do
        expect(registry.map_output_path("misc", "page.html")).to eq("misc/page")
      end
    end
  end

  describe "#legacy_redirects_for" do
    context "blog posts" do
      it "returns [] when the frontmatter date matches the filename date" do
        expect(registry.legacy_redirects_for(
          "_posts/2019-10-09-metanorma-accessibility-html-word.adoc",
          "blog/2019-10-09-metanorma-accessibility-html-word",
          frontmatter_date: "2019-10-09",
        )).to eq([])
      end

      it "redirects the frontmatter-date URL when it differs from the filename date" do
        expect(registry.legacy_redirects_for(
          "_posts/2019-10-09-metanorma-accessibility-html-word.adoc",
          "blog/2019-10-09-metanorma-accessibility-html-word",
          frontmatter_date: "2019-10-08",
        )).to eq(["/blog/2019-10-08-metanorma-accessibility-html-word/"])
      end

      it "returns [] when no frontmatter date is given" do
        expect(registry.legacy_redirects_for(
          "_posts/2018-08-24-metanorma-wins-stevie-awards.adoc",
          "blog/2018-08-24-metanorma-wins-stevie-awards",
        )).to eq([])
      end
    end

    context "reference_docs" do
      it "redirects the source URL when the output key differs" do
        expect(registry.legacy_redirects_for(
          "reference_docs/Ref-ISO-document-attributes.adoc",
          "reference/iso-document-attributes",
        )).to eq(["/reference_docs/Ref-ISO-document-attributes/"])
      end

      it "returns [] when the production path equals the output key" do
        expect(registry.legacy_redirects_for(
          "reference_docs/Ref-ISO-document-attributes.adoc",
          "reference_docs/Ref-ISO-document-attributes",
        )).to eq([])
      end
    end

    context "regular content" do
      it "returns [] when the production path equals the output key" do
        expect(registry.legacy_redirects_for("author/iso.adoc", "author/iso")).to eq([])
      end

      it "redirects the snake_case source URL when the output was kebabed" do
        expect(registry.legacy_redirects_for("learn/exercises_code/exercise_one.adoc",
                                             "learn/exercises-code/exercise-one"))
          .to eq(["/learn/exercises_code/exercise_one/"])
      end

      it "strips the _pages/ prefix when deriving the production path" do
        expect(registry.legacy_redirects_for("_pages/install.adoc", "install/index"))
          .to eq(["/install/"])
      end

      it "returns [] for _pages files whose prod path matches the output key" do
        expect(registry.legacy_redirects_for("_pages/install/linux.adoc", "install/linux")).to eq([])
      end

      it "redirects nested source URLs" do
        expect(registry.legacy_redirects_for("author/basics/workflow.adoc", "author/basics/workflow-x"))
          .to eq(["/author/basics/workflow/"])
      end
    end
  end
end
