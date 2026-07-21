# frozen_string_literal: true

module Convert
  # Source collection and asset copying. The directories and extensions
  # scanned come from the SectionRegistry (src/config/sections.yml) —
  # no separate dir lists live here.
  module Sources
    ASSET_EXTENSIONS = %w[.png .jpg .jpeg .gif .svg .webp .pdf .bmp .tiff .csv .json .xml .yaml .yml].freeze

    module_function

    # All source files under the registry's top-level source dirs, as
    # SourceFile objects sorted by path. Superseded files are excluded.
    # scan_cache (optional Hash) is shared across the run's SourceFiles
    # so a popular include file is read from disk only once.
    def collect(site_root:, registry:, nav_titles:, scan_cache: nil)
      patterns = registry.top_level_source_dirs.flat_map { |dir|
        registry.source_extensions_under(dir).map { |ext| "#{dir}/**/*.#{ext}" }
      }

      files = []
      patterns.each do |pattern|
        Dir.glob(File.join(site_root, pattern)).each do |f|
          # Glob also matches *directories* named *.adoc — they are not
          # source files (and would crash File.read downstream).
          next if File.directory?(f)
          next if f.include?("AGENTS.md")
          rel = f.sub("#{site_root}/", "")
          next if PathMapping::SUPERSEDED.key?(rel)
          files << f
        end
      end

      files.sort.map do |f|
        rel_dir = File.dirname(f).sub("#{site_root}/", "")
        section = registry.for_source_dir(rel_dir) || Section.fallback
        SourceFile.new(path: f, section: section, site_root: site_root,
                       nav_titles: nav_titles, scan_cache: scan_cache)
      end
    end

    # Copy non-adoc assets (images, PDFs, etc.) into public/.
    def copy_assets(site_root:, public_dir:, registry:)
      registry.top_level_source_dirs.each do |rel|
        src_dir = File.join(site_root, rel)
        next unless File.directory?(src_dir)
        Find.find(src_dir) do |path|
          next if File.directory?(path)
          # Skip underscore-prefixed files (e.g. _nav.yml): they are
          # content config, not servable assets — src/lib/nav-tree.ts
          # reads the root sources, nothing reads the public copies.
          next if File.basename(path).start_with?("_")
          ext = File.extname(path).downcase
          next unless ASSET_EXTENSIONS.include?(ext)
          rel_path = path.sub("#{site_root}/", "")
          # Superseded sources are filtered from pages AND assets alike.
          next if PathMapping::SUPERSEDED.key?(rel_path)
          # Underscore-led segments are private source dirs (_posts etc.)
          # whose assets are served without the underscore.
          kebab_path = rel_path.split("/").map { |seg| PathMapping.kebab_segment(seg.sub(/\A_/, "")) }.join("/")
          dest_path = File.join(public_dir, kebab_path)
          FileUtils.mkdir_p(File.dirname(dest_path))
          FileUtils.cp(path, dest_path) unless File.exist?(dest_path) && File.mtime(dest_path) >= File.mtime(path)
        end
      end
    end
  end
end
