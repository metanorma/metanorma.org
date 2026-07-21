# frozen_string_literal: true

module Convert
  # Memoized reader for _nav.yml title lookups. One instance per
  # converter run: previously every lookup re-parsed the YAML from disk.
  # Parse problems are logged with the filename (previously swallowed).
  class NavTitles
    def initialize(site_root:, err: $stderr)
      @site_root = site_root
      @err = err
      @cache = {}
    end

    # Existing _nav.yml files under a source dir (repo-root relative,
    # sorted), plus the site-root _nav.yml candidate — the nav files whose
    # mtimes go into a file's cache fingerprint. nav_title_for can climb
    # to the parent of a top-level dir ("."), i.e. the site root.
    def files_under(rel_dir)
      files = Dir.glob(File.join(@site_root, rel_dir, "**", "_nav.yml"))
      root_nav = File.join(@site_root, "_nav.yml")
      files << root_nav if File.exist?(root_nav)
      files.map { |f| f.sub("#{@site_root}/", "") }.uniq.sort
    end

    # Look up the human-readable title for a page from _nav.yml files.
    # Strategy (first match wins):
    # 1. The target directory's own _nav.yml `title:` (section title)
    # 2. An item in rel_dir's _nav.yml with matching `file:` or `dir:`
    # 3. An item in the parent's _nav.yml with matching `file:` or `dir:`
    def title_for(rel_dir, file_base)
      subdir = rel_dir == "." ? file_base : File.join(rel_dir, file_base)
      subdir_nav = read_nav_yml(subdir)
      return subdir_nav["title"] if subdir_nav && subdir_nav["title"]

      nav = read_nav_yml(rel_dir)
      title = find_nav_title(nav["items"], file_base) if nav
      return title if title

      parent_dir = File.dirname(rel_dir)
      return nil if parent_dir == rel_dir
      nav = read_nav_yml(parent_dir)
      find_nav_title(nav["items"], file_base) if nav
    end

    private

    # Read _nav.yml for a directory (relative to site_root), memoized.
    # Tries both the exact path and the snake_case variant (source dirs
    # may use either dashes or underscores). Returns the parsed YAML
    # (Hash, or false for an empty file) or nil when no file exists.
    def read_nav_yml(rel_dir)
      return @cache[rel_dir] if @cache.key?(rel_dir)

      @cache[rel_dir] = load_nav_yml(rel_dir)
    end

    def load_nav_yml(rel_dir)
      [rel_dir, rel_dir.tr("-", "_")].uniq.each do |dir|
        path = File.join(@site_root, dir, "_nav.yml")
        next unless File.exist?(path)
        begin
          return YAML.load_file(path)
        rescue StandardError => e
          @err.puts "  WARNING: could not parse #{dir}/_nav.yml: #{e.message}"
          next
        end
      end
      nil
    end

    # Recursively search nav items for one whose `file:` or `dir:`
    # matches file_base. Both can reference a page: `file:` for a
    # standalone page, `dir:` for a sub-directory landing page.
    def find_nav_title(items, file_base)
      return nil unless items.is_a?(Array)
      items.each do |item|
        next unless item.is_a?(Hash)
        if item["title"] && (item["file"] == file_base || item["dir"] == file_base)
          return item["title"]
        end
        if item["items"]
          title = find_nav_title(item["items"], file_base)
          return title if title
        end
      end
      nil
    end
  end
end
