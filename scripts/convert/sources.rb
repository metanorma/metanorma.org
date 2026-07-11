# frozen_string_literal: true

require "fileutils"
require "find"

require_relative "path_mapping"

module Convert
  # Source collection and asset copying.
  module Sources
    module_function

    def collect_source_files(site_root:)
      patterns = PathMapping::SOURCE_DIRS.flat_map { |dir|
        exts = dir == "_pages" ? %w[adoc html] : %w[adoc]
        exts.map { |ext| "#{dir}/**/*.#{ext}" }
      }

      files = []
      patterns.each do |pattern|
        Dir.glob(File.join(site_root, pattern)).each do |f|
          next if f.include?("AGENTS.md")
          rel = f.sub("#{site_root}/", "")
          next if PathMapping::SUPERSEDED.key?(rel)
          files << f
        end
      end
      files.sort
    end

    HAND_AUTHORED_SKIP = %w[
      flavors/mpfa.md
    ].freeze

    def copy_hand_authored(output_dir:, scripts_dir:)
      hand_authored_dir = File.join(scripts_dir, "hand-authored")
      return unless File.directory?(hand_authored_dir)

      Find.find(hand_authored_dir) do |src|
        next unless File.file?(src)
        rel = src.sub("#{hand_authored_dir}/", "")
        next if HAND_AUTHORED_SKIP.include?(rel)
        dest = File.join(output_dir, rel)
        FileUtils.mkdir_p(File.dirname(dest))
        FileUtils.cp(src, dest)
      end
    end

    ASSET_SOURCE_DIRS = PathMapping::SOURCE_DIRS
    ASSET_EXTENSIONS = %w[.png .jpg .jpeg .gif .svg .webp .pdf .bmp .tiff .csv .json .xml .yaml .yml].freeze

    STATIC_HTML_FILES = {
      "learn/template.html" => "learn/template.html",
    }.freeze

    def copy_assets(site_root:, public_dir:)
      STATIC_HTML_FILES.each do |src, dest|
        src_path = File.join(site_root, src)
        next unless File.exist?(src_path)
        dest_path = File.join(public_dir, dest)
        FileUtils.mkdir_p(File.dirname(dest_path))
        FileUtils.cp(src_path, dest_path) unless File.exist?(dest_path) && File.mtime(dest_path) >= File.mtime(src_path)
      end

      ASSET_SOURCE_DIRS.each do |rel|
        src_dir = File.join(site_root, rel)
        next unless File.directory?(src_dir)
        Find.find(src_dir) do |path|
          next if File.directory?(path)
          ext = File.extname(path).downcase
          next unless ASSET_EXTENSIONS.include?(ext)
          rel_path = path.sub("#{site_root}/", "")
          kebab_path = rel_path.split("/").map { |seg| seg.sub(/\A_/, "").tr("_", "-") }.join("/")
          dest_path = File.join(public_dir, kebab_path)
          FileUtils.mkdir_p(File.dirname(dest_path))
          FileUtils.cp(path, dest_path) unless File.exist?(dest_path) && File.mtime(dest_path) >= File.mtime(path)
        end
      end
    end
  end
end
