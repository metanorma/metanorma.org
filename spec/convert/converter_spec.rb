# frozen_string_literal: true

require "tmpdir"
require "json"
require "stringio"

# End-to-end specs for Convert::Converter on a temporary fixture tree:
# collect → convert (cache-aware) → hub synthesis → prune → manifest,
# plus the dependency-aware cache invalidation contract.
RSpec.describe Convert::Converter do
  def write_fixture(dir)
    File.write(File.join(dir, "sections.yml"), <<~YAML)
      sections:
        - id: docs
          source_dir: docs
          output_prefix: docs
          nav_root: true
          mapping: tree
        - id: blog
          source_dir: _posts
          output_prefix: blog
          nav_root: false
          mapping: date_prefix
        - id: pages
          source_dir: _pages
          output_prefix: ""
          nav_root: false
          mapping: fixed
          files:
            home.adoc: home/index
    YAML
    FileUtils.mkdir_p(File.join(dir, "docs"))
    File.write(File.join(dir, "docs", "_nav.yml"), "title: Docs\nitems:\n  - title: Plain Page\n    file: plain\n")
    File.write(File.join(dir, "docs", "guide.adoc"), "---\ntitle: Guide\n---\n\nBody.\n\ninclude::shared.adoc[]\n")
    File.write(File.join(dir, "docs", "plain.adoc"), "Just a body, no title.\n")
    # Include target outside every section dir: site-root fallback only,
    # and never collected as a source page itself.
    File.write(File.join(dir, "shared.adoc"), "Shared include content.\n")
    FileUtils.mkdir_p(File.join(dir, "_posts"))
    File.write(File.join(dir, "_posts", "2024-01-02-test-post.adoc"), "---\ntitle: Test Post\ndate: 2024-01-02\n---\n\nPost body.\n")
  end

  def run_converter(dir, code_version: "v1")
    out = StringIO.new
    converter = described_class.new(
      site_root: dir,
      config_path: File.join(dir, "sections.yml"),
      mirror_json_dir: File.join(dir, "mirror-json"),
      public_dir: File.join(dir, "public"),
      code_version: code_version,
      out: out, err: StringIO.new,
    )
    exit_code = converter.run
    [exit_code, converter, out.string]
  end

  def manifest_for(dir)
    JSON.parse(File.read(File.join(dir, "mirror-json", "manifest.json")))
  end

  def statuses(manifest)
    manifest["file_map"].transform_values { |info| info["status"] }
  end

  def in_tmpdir
    Dir.mktmpdir { |dir| yield dir }
  end

  it "converts a fixture tree end to end, with hubs and manifest" do
    in_tmpdir do |dir|
      write_fixture(dir)
      exit_code, converter, = run_converter(dir)

      expect(exit_code).to eq(0)
      expect(converter.stats).to include(ok: 5, fail: 0, unmapped: 0, cached: 0)

      guide = JSON.parse(File.read(File.join(dir, "mirror-json", "docs", "guide.json")))
      expect(guide["title"]).to eq("Guide")
      expect(guide["mirror_json"]).to include("Shared include content")

      plain = JSON.parse(File.read(File.join(dir, "mirror-json", "docs", "plain.json")))
      expect(plain["title"]).to eq("Plain Page") # from docs/_nav.yml

      expect(File.exist?(File.join(dir, "mirror-json", "blog", "2024-01-02-test-post.json"))).to be(true)

      # Hub synthesis: docs/ and blog/ have children but no index source.
      expect(File.exist?(File.join(dir, "mirror-json", "docs", "index.json"))).to be(true)
      expect(File.exist?(File.join(dir, "mirror-json", "blog", "index.json"))).to be(true)

      manifest = manifest_for(dir)
      expect(manifest["total_files"]).to eq(3)
      expect(manifest["code_version"]).to eq("v1")
      file_map = manifest["file_map"]
      expect(file_map["docs/index"]).to include("source" => "synthesized hub", "hub" => true)
      expect(file_map["docs/guide"]["deps"]).to eq(["shared.adoc"])
      expect(file_map["docs/guide"]["fingerprint"]).to be_a(String)
    end
  end

  it "caches every envelope on an unchanged second run" do
    in_tmpdir do |dir|
      write_fixture(dir)
      run_converter(dir)
      _, converter, = run_converter(dir)
      expect(converter.stats).to include(ok: 0, cached: 5, fail: 0)
      expect(statuses(manifest_for(dir)).values.uniq).to eq(["cached"])
    end
  end

  it "rebuilds only the includers when an include:: dependency changes" do
    in_tmpdir do |dir|
      write_fixture(dir)
      run_converter(dir)

      shared = File.join(dir, "shared.adoc")
      FileUtils.touch(shared, mtime: File.mtime(shared) + 5)
      run_converter(dir)

      expect(statuses(manifest_for(dir))).to eq(
        "docs/guide" => "ok",          # includes shared.adoc
        "docs/plain" => "cached",
        "blog/2024-01-02-test-post" => "cached",
        "docs/index" => "ok",          # hub: child guide.json was rebuilt
        "blog/index" => "cached",
      )
    end
  end

  it "rebuilds a section when its _nav.yml changes (nav titles feed titles)" do
    in_tmpdir do |dir|
      write_fixture(dir)
      run_converter(dir)

      nav = File.join(dir, "docs", "_nav.yml")
      File.write(nav, "title: Docs\nitems:\n  - title: Renamed Plain\n    file: plain\n")
      FileUtils.touch(nav, mtime: File.mtime(nav) + 5)
      run_converter(dir)

      expect(statuses(manifest_for(dir))).to eq(
        "docs/guide" => "ok",
        "docs/plain" => "ok",
        "blog/2024-01-02-test-post" => "cached",
        "docs/index" => "ok",
        "blog/index" => "cached",
      )
      plain = JSON.parse(File.read(File.join(dir, "mirror-json", "docs", "plain.json")))
      expect(plain["title"]).to eq("Renamed Plain")
    end
  end

  it "rebuilds everything when the converter code version changes" do
    in_tmpdir do |dir|
      write_fixture(dir)
      run_converter(dir, code_version: "v1")
      _, converter, = run_converter(dir, code_version: "v2")
      expect(converter.stats).to include(ok: 5, cached: 0)
    end
  end

  it "does not rebuild when the previous run failed on that file" do
    in_tmpdir do |dir|
      write_fixture(dir)
      # A file whose conversion errors: empty-body hub.adoc with a
      # *directory* named hub/broken.adoc (EISDIR during child read).
      File.write(File.join(dir, "docs", "hub.adoc"), "---\ntitle: Hub\n---\n")
      FileUtils.mkdir_p(File.join(dir, "docs", "hub", "broken.adoc"))

      exit_code, converter, = run_converter(dir)
      expect(exit_code).to eq(1)
      expect(converter.stats[:fail]).to eq(1)
      expect(manifest_for(dir)["file_map"]["docs/hub"]["status"]).to eq("error")

      # Second run: the failed file must be retried (errors are not cached).
      FileUtils.rm_rf(File.join(dir, "docs", "hub"))
      _, converter2, = run_converter(dir)
      expect(converter2.stats[:fail]).to eq(0)
      expect(manifest_for(dir)["file_map"]["docs/hub"]["status"]).to eq("ok")
    end
  end

  it "prunes orphan envelopes when a source disappears" do
    in_tmpdir do |dir|
      write_fixture(dir)
      run_converter(dir)

      File.delete(File.join(dir, "docs", "plain.adoc"))
      _, converter, out = run_converter(dir)

      expect(out).to include("pruned orphan envelope: docs/plain.json")
      expect(File.exist?(File.join(dir, "mirror-json", "docs", "plain.json"))).to be(false)
      # The hub and the surviving page stay.
      manifest = manifest_for(dir)
      expect(manifest["file_map"].keys).to contain_exactly(
        "docs/guide", "docs/index", "blog/2024-01-02-test-post", "blog/index",
      )
      expect(File.exist?(File.join(dir, "mirror-json", "docs", "index.json"))).to be(true)
    end
  end

  it "flags fixed-map files with no entry as unmapped" do
    in_tmpdir do |dir|
      write_fixture(dir)
      FileUtils.mkdir_p(File.join(dir, "_pages"))
      File.write(File.join(dir, "_pages", "home.adoc"), "---\ntitle: Home\n---\n\nHome body.\n")
      File.write(File.join(dir, "_pages", "mystery.adoc"), "Mystery.\n")

      exit_code, converter, = run_converter(dir)
      expect(exit_code).to eq(0)
      expect(converter.stats[:unmapped]).to eq(1)
      expect(manifest_for(dir)["file_map"]["home/index"]["status"]).to eq("ok")
      expect(manifest_for(dir)["file_map"].keys).not_to include("mystery")
    end
  end

  it "force: true wipes the tree and rebuilds everything" do
    in_tmpdir do |dir|
      write_fixture(dir)
      run_converter(dir)
      converter = described_class.new(
        site_root: dir,
        config_path: File.join(dir, "sections.yml"),
        mirror_json_dir: File.join(dir, "mirror-json"),
        public_dir: File.join(dir, "public"),
        force: true, code_version: "v1",
        out: StringIO.new, err: StringIO.new,
      )
      converter.run
      expect(converter.stats).to include(ok: 5, cached: 0)
    end
  end
end
