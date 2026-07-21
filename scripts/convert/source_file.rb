# frozen_string_literal: true

module Convert
  # A single source file (.adoc, or .html under _pages): its section,
  # output key, include:: dependency closure, and the mtime fingerprint
  # driving cache invalidation. The file content is read at most once
  # per run — the frontmatter date and the conversion pipeline share it.
  class SourceFile
    # include::target[...] at line start (leading whitespace allowed).
    INCLUDE_RE = /^\s*include::([^\s\[]+)\[/.freeze
    URI_RE = %r{\A[A-Za-z][A-Za-z0-9+.-]*://}.freeze

    attr_reader :path, :section, :site_root

    def initialize(path:, section:, site_root:, nav_titles: nil, scan_cache: nil)
      @path = path
      @section = section
      @site_root = site_root
      @nav_titles = nav_titles
      @scan_cache = scan_cache
    end

    def rel_path
      @rel_path ||= path.sub("#{site_root}/", "")
    end

    def rel_dir
      File.dirname(rel_path)
    end

    def filename
      File.basename(path)
    end

    def output_key
      section&.map_output_path(rel_dir, filename)
    end

    def content
      @content ||= File.read(path)
    end

    def frontmatter_data
      @frontmatter_data ||= Rendering.read_frontmatter_data(content, path: rel_path)
    end

    # Leading YYYY-MM-DD of the frontmatter date, or nil.
    def frontmatter_date
      frontmatter_data["date"].to_s[%r{\A\d{4}-\d{2}-\d{2}}, 0]
    end

    def legacy_redirects
      section.legacy_redirects_for(rel_path, output_key, frontmatter_date: frontmatter_date)
    end

    # Repo-root-relative paths of existing files this source pulls in via
    # include:: (transitively), sorted. Resolution mirrors
    # SiteRootFallbackResolver: including-file-relative first, then
    # site-root-relative.
    def dependencies
      dependency_paths.select { |dep| File.file?(File.join(site_root, dep)) }
    end

    # Fingerprint inputs: repo-relative path of every resolution
    # candidate, existing or not (a missing include that appears later
    # must invalidate the cache).
    def fingerprint(code_version:)
      digest = Digest::SHA256.new
      digest << code_version.to_s << "\n"
      append_mtime = lambda do |rel|
        full = File.join(site_root, rel)
        digest << rel << "=" << (File.exist?(full) ? File.mtime(full).to_f.to_s : "missing") << "\n"
      end
      append_mtime.call(rel_path)
      dependency_paths.each(&append_mtime)
      nav_dependencies.each(&append_mtime)
      digest.hexdigest
    end

    private

    # _nav.yml files whose mtimes feed this file's fingerprint: every
    # _nav.yml under the section's source dir (nav_title_for consults the
    # file's dir chain up to the section root) plus the site-root one.
    def nav_dependencies
      return [] unless @nav_titles && section&.source_dir
      @nav_titles.files_under(section.source_dir)
    end

    # All resolution candidates of the transitive include:: closure,
    # repo-root relative, sorted.
    def dependency_paths
      @dependency_paths ||= begin
        candidates = {}
        walk = nil
        walk = lambda do |from_abs, visited|
          include_targets(from_abs).each do |target|
            paths = resolution_candidates(target, File.dirname(from_abs))
            paths.each { |p| candidates[p.sub("#{site_root}/", "")] = true }
            resolved = paths.find { |p| File.file?(p) }
            if resolved && resolved.end_with?(".adoc") && !visited.include?(resolved)
              visited << resolved
              walk.call(resolved, visited)
            end
          end
        end
        walk.call(path, [path])
        candidates.keys.sort
      end
    end

    def include_targets(abs_file)
      text = abs_file == path ? content : read_scanned(abs_file)
      targets = []
      text.to_s.each_line do |line|
        match = line.match(INCLUDE_RE)
        next unless match
        target = match[1].strip
        next if target.empty? || target.match?(URI_RE)
        targets << target
      end
      targets
    end

    # Shared per-run cache so a popular include is read from disk once,
    # no matter how many source files pull it in.
    def read_scanned(abs_file)
      if @scan_cache
        @scan_cache[abs_file] ||= File.read(abs_file)
      else
        File.read(abs_file)
      end
    end

    def resolution_candidates(target, from_dir)
      [File.expand_path(target, from_dir), File.expand_path(target, site_root)].uniq
    end
  end
end
