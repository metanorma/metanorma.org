# frozen_string_literal: true

require "tmpdir"

# Asset copying: media under source dirs lands in public/ (kebab-mapped),
# while superseded sources and underscore config files are never copied.
RSpec.describe Convert::Sources do
  def registry_for(dir)
    File.write(File.join(dir, "sections.yml"), <<~YAML)
      sections:
        - id: learn
          source_dir: learn
          output_prefix: learn
          nav_root: true
          mapping: tree
    YAML
    Convert::SectionRegistry.load(File.join(dir, "sections.yml"))
  end

  it "copies media assets, skipping superseded sources and _-files" do
    Dir.mktmpdir do |dir|
      FileUtils.mkdir_p(File.join(dir, "learn"))
      # learn/template.html is in PathMapping::SUPERSEDED (author scratch
      # template) — it must not be copied even though it sits in a source dir.
      File.write(File.join(dir, "learn", "template.html"), "<html></html>\n")
      File.write(File.join(dir, "learn", "diagram.png"), "png-bytes")
      File.write(File.join(dir, "learn", "_nav.yml"), "title: Learn\n")

      public_dir = File.join(dir, "public")
      described_class.copy_assets(
        site_root: dir, public_dir: public_dir, registry: registry_for(dir),
      )

      expect(File.read(File.join(public_dir, "learn", "diagram.png"))).to eq("png-bytes")
      expect(File.exist?(File.join(public_dir, "learn", "template.html"))).to be false
      expect(File.exist?(File.join(public_dir, "learn", "_nav.yml"))).to be false
      expect(File.exist?(File.join(public_dir, "learn", "nav.yml"))).to be false
    end
  end
end
