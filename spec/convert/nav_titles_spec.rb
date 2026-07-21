# frozen_string_literal: true

require "tmpdir"
require "stringio"

# Specs for Convert::NavTitles — the memoized _nav.yml reader that feeds
# title fallbacks. Lookup strategies are preserved from the old
# PathMapping.nav_title_for.
RSpec.describe Convert::NavTitles do
  let(:null_err) { File.open(File::NULL, "w") }

  def in_tmpdir
    Dir.mktmpdir { |dir| yield dir }
  end

  describe "#title_for" do
    it "prefers the target directory's own _nav.yml title" do
      in_tmpdir do |dir|
        FileUtils.mkdir_p(File.join(dir, "docs", "sub"))
        File.write(File.join(dir, "docs", "sub", "_nav.yml"), "title: Sub Title\n")
        nav = described_class.new(site_root: dir, err: null_err)
        expect(nav.title_for("docs", "sub")).to eq("Sub Title")
      end
    end

    it "finds an item with a matching file: in rel_dir's _nav.yml" do
      in_tmpdir do |dir|
        FileUtils.mkdir_p(File.join(dir, "docs"))
        File.write(File.join(dir, "docs", "_nav.yml"), "title: Docs\nitems:\n  - title: Page One\n    file: page-one\n")
        nav = described_class.new(site_root: dir, err: null_err)
        expect(nav.title_for("docs", "page-one")).to eq("Page One")
      end
    end

    it "finds an item with a matching dir: in the parent's _nav.yml" do
      in_tmpdir do |dir|
        FileUtils.mkdir_p(File.join(dir, "docs", "sub", "leaf"))
        File.write(File.join(dir, "docs", "_nav.yml"), "items:\n  - title: Sub Section\n    dir: sub\n")
        File.write(File.join(dir, "docs", "sub", "_nav.yml"), "items:\n  - title: Leaf\n    file: leaf\n")
        nav = described_class.new(site_root: dir, err: null_err)
        expect(nav.title_for("docs/sub", "leaf")).to eq("Leaf")
      end
    end

    it "returns nil when nothing matches" do
      in_tmpdir do |dir|
        FileUtils.mkdir_p(File.join(dir, "docs"))
        nav = described_class.new(site_root: dir, err: null_err)
        expect(nav.title_for("docs", "missing")).to be_nil
      end
    end

    it "memoizes reads (same parsed object returned)" do
      in_tmpdir do |dir|
        FileUtils.mkdir_p(File.join(dir, "docs"))
        File.write(File.join(dir, "docs", "_nav.yml"), "title: Docs\nitems:\n  - title: Page One\n    file: page-one\n")
        nav = described_class.new(site_root: dir, err: null_err)
        first = nav.title_for("docs", "page-one")
        # Rewriting the file must not change the memoized result.
        File.write(File.join(dir, "docs", "_nav.yml"), "title: Changed\n")
        expect(nav.title_for("docs", "page-one")).to eq(first)
      end
    end

    it "logs malformed _nav.yml with its filename" do
      in_tmpdir do |dir|
        FileUtils.mkdir_p(File.join(dir, "docs"))
        File.write(File.join(dir, "docs", "_nav.yml"), ":\n  - [not valid yaml\n")
        err = StringIO.new
        nav = described_class.new(site_root: dir, err: err)
        expect(nav.title_for("docs", "page")).to be_nil
        expect(err.string).to include("docs/_nav.yml")
      end
    end
  end

  describe "#files_under" do
    it "lists _nav.yml files under a dir, repo-relative and sorted" do
      in_tmpdir do |dir|
        FileUtils.mkdir_p(File.join(dir, "docs", "sub"))
        File.write(File.join(dir, "docs", "_nav.yml"), "title: D\n")
        File.write(File.join(dir, "docs", "sub", "_nav.yml"), "title: S\n")
        nav = described_class.new(site_root: dir, err: null_err)
        expect(nav.files_under("docs")).to eq(["docs/_nav.yml", "docs/sub/_nav.yml"])
      end
    end

    it "includes the site-root _nav.yml when present" do
      in_tmpdir do |dir|
        File.write(File.join(dir, "_nav.yml"), "title: Root\n")
        FileUtils.mkdir_p(File.join(dir, "docs"))
        nav = described_class.new(site_root: dir, err: null_err)
        expect(nav.files_under("docs")).to eq(["_nav.yml"])
      end
    end
  end
end
