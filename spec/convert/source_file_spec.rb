# frozen_string_literal: true

require "tmpdir"

# Specs for Convert::SourceFile — one source .adoc with its content
# (read once), include:: dependency closure, and cache fingerprint.
RSpec.describe Convert::SourceFile do
  def make_section(mapping: "tree", source_dir: "docs", output_prefix: "docs")
    Convert::Section.new(id: "docs", source_dir: source_dir, output_prefix: output_prefix, mapping: mapping)
  end

  def in_tmpdir
    Dir.mktmpdir { |dir| yield dir }
  end

  describe "#content (read once per run)" do
    it "memoizes the file content" do
      in_tmpdir do |dir|
        path = File.join(dir, "page.adoc")
        File.write(path, "Body.\n")
        sf = described_class.new(path: path, section: nil, site_root: dir)
        first = sf.content
        expect(first).to eq("Body.\n")
        expect(sf.content).to equal(first) # same object: no second read
      end
    end
  end

  describe "#frontmatter_date" do
    it "extracts the leading date of the frontmatter date" do
      in_tmpdir do |dir|
        path = File.join(dir, "post.adoc")
        File.write(path, "---\ndate: 2019-10-09T08:00:00Z\n---\n\nBody.\n")
        sf = described_class.new(path: path, section: nil, site_root: dir)
        expect(sf.frontmatter_date).to eq("2019-10-09")
      end
    end

    it "returns nil without a frontmatter date" do
      in_tmpdir do |dir|
        path = File.join(dir, "page.adoc")
        File.write(path, "---\ntitle: T\n---\n\nBody.\n")
        sf = described_class.new(path: path, section: nil, site_root: dir)
        expect(sf.frontmatter_date).to be_nil
      end
    end
  end

  describe "#output_key and #legacy_redirects (delegated to the section)" do
    it "maps via the section and computes redirects" do
      in_tmpdir do |dir|
        path = File.join(dir, "docs", "my_page.adoc")
        FileUtils.mkdir_p(File.dirname(path))
        File.write(path, "Body.\n")
        sf = described_class.new(path: path, section: make_section, site_root: dir)
        expect(sf.output_key).to eq("docs/my-page")
        expect(sf.legacy_redirects).to eq(["/docs/my_page/"])
      end
    end
  end

  describe "#dependencies (include:: closure)" do
    it "finds file-relative includes transitively" do
      in_tmpdir do |dir|
        File.write(File.join(dir, "main.adoc"), "Body.\n\ninclude::partials/one.adoc[]\n")
        FileUtils.mkdir_p(File.join(dir, "partials"))
        File.write(File.join(dir, "partials", "one.adoc"), "include::two.adoc[]\n")
        File.write(File.join(dir, "partials", "two.adoc"), "Nested.\n")

        sf = described_class.new(path: File.join(dir, "main.adoc"), section: nil, site_root: dir)
        expect(sf.dependencies).to contain_exactly("partials/one.adoc", "partials/two.adoc")
      end
    end

    it "falls back to site-root-relative resolution" do
      in_tmpdir do |dir|
        FileUtils.mkdir_p(File.join(dir, "deep"))
        File.write(File.join(dir, "deep", "main.adoc"), "include::shared.adoc[]\n")
        File.write(File.join(dir, "shared.adoc"), "Shared.\n")

        sf = described_class.new(path: File.join(dir, "deep", "main.adoc"), section: nil, site_root: dir)
        expect(sf.dependencies).to include("shared.adoc")
      end
    end

    it "skips URI includes and survives include cycles" do
      in_tmpdir do |dir|
        File.write(File.join(dir, "a.adoc"), "include::https://example.com/x.adoc[]\n\ninclude::b.adoc[]\n")
        File.write(File.join(dir, "b.adoc"), "include::a.adoc[]\n")

        sf = described_class.new(path: File.join(dir, "a.adoc"), section: nil, site_root: dir)
        expect(sf.dependencies).to contain_exactly("a.adoc", "b.adoc")
      end
    end

    it "shares a scan cache so includes are read from disk once per run" do
      in_tmpdir do |dir|
        File.write(File.join(dir, "shared.adoc"), "Shared.\n")
        File.write(File.join(dir, "one.adoc"), "include::shared.adoc[]\n")
        File.write(File.join(dir, "two.adoc"), "include::shared.adoc[]\n")
        cache = {}
        described_class.new(path: File.join(dir, "one.adoc"), section: nil, site_root: dir, scan_cache: cache).dependencies
        described_class.new(path: File.join(dir, "two.adoc"), section: nil, site_root: dir, scan_cache: cache).dependencies
        expect(cache.keys).to eq([File.join(dir, "shared.adoc")])
      end
    end
  end

  describe "#fingerprint" do
    it "changes when the source file changes" do
      in_tmpdir do |dir|
        path = File.join(dir, "page.adoc")
        File.write(path, "One.\n")
        sf = described_class.new(path: path, section: make_section, site_root: dir)
        before = sf.fingerprint(code_version: "v1")
        FileUtils.touch(path, mtime: Time.now + 10)
        after = described_class.new(path: path, section: make_section, site_root: dir).fingerprint(code_version: "v1")
        expect(after).not_to eq(before)
      end
    end

    it "changes when an include dependency changes" do
      in_tmpdir do |dir|
        dep = File.join(dir, "dep.adoc")
        File.write(dep, "Dep.\n")
        File.write(File.join(dir, "main.adoc"), "include::dep.adoc[]\n")
        before = described_class.new(path: File.join(dir, "main.adoc"), section: nil, site_root: dir)
                              .fingerprint(code_version: "v1")
        FileUtils.touch(dep, mtime: Time.now + 10)
        after = described_class.new(path: File.join(dir, "main.adoc"), section: nil, site_root: dir)
                             .fingerprint(code_version: "v1")
        expect(after).not_to eq(before)
      end
    end

    it "changes when a _nav.yml under the section's source dir changes" do
      in_tmpdir do |dir|
        nav_path = File.join(dir, "docs", "_nav.yml")
        FileUtils.mkdir_p(File.dirname(nav_path))
        File.write(nav_path, "title: Docs\n")
        File.write(File.join(dir, "docs", "page.adoc"), "Body.\n")
        nav_titles = Convert::NavTitles.new(site_root: dir, err: File.open(File::NULL, "w"))
        build = -> { described_class.new(path: File.join(dir, "docs", "page.adoc"), section: make_section,
                                         site_root: dir, nav_titles: nav_titles) }
        before = build.call.fingerprint(code_version: "v1")
        FileUtils.touch(nav_path, mtime: Time.now + 10)
        expect(build.call.fingerprint(code_version: "v1")).not_to eq(before)
      end
    end

    it "changes when the converter code version changes" do
      in_tmpdir do |dir|
        path = File.join(dir, "page.adoc")
        File.write(path, "Body.\n")
        sf = described_class.new(path: path, section: nil, site_root: dir)
        expect(sf.fingerprint(code_version: "v2")).not_to eq(sf.fingerprint(code_version: "v1"))
      end
    end
  end
end
