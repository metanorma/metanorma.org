# frozen_string_literal: true

require "yaml"
require "date"
require "fileutils"
require "open3"
require "cgi"
require "timeout"

# Upstream content sync.
#
# Pulls library docs and model diagrams from per-flavor GitHub repos into the
# local software/{flavor}/ and specs/{model}/ subtrees, based on the
# frontmatter already declared on each software/{flavor}.adoc and
# specs/{model}.adoc index page.
#
# Adding a new flavor = adding frontmatter to its .adoc index page; this file
# should not need to change.

SITE_ROOT = File.expand_path(__dir__)
UPSTREAM_CACHE = File.join(SITE_ROOT, "_upstream")

# Map: destination_dir (relative to SITE_ROOT) => { repo:, branch:, subtree: }
def upstream_targets
  targets = []

  # Library docs: software/{flavor}.adoc with docs.git_repo_subtree.
  Dir.glob(File.join(SITE_ROOT, "software", "*.adoc")).each do |adoc|
    frontmatter = read_frontmatter(adoc)
    next unless frontmatter.is_a?(Hash) && frontmatter["docs"]

    docs = frontmatter["docs"]
    subtree = docs["git_repo_subtree"] || "docs"
    repo = docs["git_repo_url"] || frontmatter["repo_url"]
    next unless repo

    branch = docs["git_repo_branch"] || "main"
    flavor = File.basename(adoc, ".adoc")
    targets << {
      kind: "library",
      name: flavor,
      repo: repo,
      branch: branch,
      subtree: subtree,
      dest_subdir: "software/#{flavor}/docs",
    }
  end

  # Model diagrams: specs/{model}.adoc with spec_source.git_repo_subtree.
  Dir.glob(File.join(SITE_ROOT, "specs", "*.adoc")).each do |adoc|
    frontmatter = read_frontmatter(adoc)
    next unless frontmatter.is_a?(Hash) && frontmatter["spec_source"]

    spec = frontmatter["spec_source"]
    subtree = spec["git_repo_subtree"] || "images"
    repo = spec["git_repo_url"] || frontmatter["source_url"]
    next unless repo

    branch = spec["git_repo_branch"] || "main"
    model = File.basename(adoc, ".adoc")
    targets << {
      kind: "model",
      name: model,
      repo: repo,
      branch: branch,
      subtree: subtree,
      dest_subdir: "specs/#{model}/#{subtree}",
    }
  end

  targets
end

def read_frontmatter(adoc_path)
  content = File.read(adoc_path)
  return {} unless content.start_with?("---\n")

  end_index = content.index("\n---", 4)
  return {} unless end_index

  yaml = content[4...end_index]
  YAML.safe_load(yaml, permitted_classes: [Date, Time]) || {}
rescue Psych::SyntaxError => e
  warn "  ! could not parse frontmatter in #{adoc_path}: #{e.message}"
  {}
end

def repo_slug(repo_url)
  # https://github.com/metanorma/metanorma-iso => metanorma-iso
  repo_url.sub(%r{\.git\Z}, "").split("/").last
end

def cache_dir_for(repo_url)
  File.join(UPSTREAM_CACHE, repo_slug(repo_url))
end

def sh(*cmd)
  stdout, status = Open3.capture2e(*cmd)
  unless status.success?
    warn "  ! command failed (#{status}): #{cmd.join(' ')}"
    warn stdout
    return [false, stdout]
  end
  [true, stdout]
end

def ensure_clone(repo_url, branch, cache_dir)
  if File.directory?(File.join(cache_dir, ".git"))
    return :up_to_date if fresh?(cache_dir, branch)
    Dir.chdir(cache_dir) do
      sh("git", "fetch", "--depth", "1", "origin", branch)
      sh("git", "checkout", "FETCH_HEAD")
    end
    return :updated
  end

  FileUtils.mkdir_p(UPSTREAM_CACHE)
  ok, _ = sh_with_timeout(
    120,
    "git", "clone", "--depth", "1",
    "--branch", branch,
    repo_url, cache_dir,
  )
  ok ? :cloned : :failed
end

def sh_with_timeout(timeout_sec, *cmd)
  pid = Process.spawn(*cmd)
  begin
    Timeout.timeout(timeout_sec) { Process.wait(pid) }
    [$?.success?, ""]
  rescue Timeout::Error
    Process.kill("TERM", pid)
    Process.wait(pid) rescue nil
    warn "  ! timeout after #{timeout_sec}s: #{cmd.join(' ')}"
    [false, ""]
  end
end

def fresh?(cache_dir, branch)
  Dir.chdir(cache_dir) do
    ok, out = sh("git", "ls-remote", "origin", branch)
    return false unless ok
    remote = out.to_s.lines.first.to_s.split(/\s+/).first
    local = File.read(File.join(".git", "FETCH_HEAD")).split.first rescue nil
    remote == local
  end
end

def copy_subtree(cache_dir, subtree, dest)
  src = File.join(cache_dir, subtree)
  unless File.directory?(src)
    warn "  ! subtree #{subtree}/ not found in upstream"
    return false
  end

  # Wipe destination contents (but keep the dir for cache parity).
  FileUtils.rm_rf(dest)
  FileUtils.mkdir_p(File.dirname(dest))
  FileUtils.cp_r(src, dest)
  true
end

def sync_target(target)
  repo = target[:repo]
  branch = target[:branch]
  cache = cache_dir_for(repo)
  dest = File.join(SITE_ROOT, target[:dest_subdir])

  status = ensure_clone(repo, branch, cache)
  return [:failed, target] if status == :failed

  ok = copy_subtree(cache, target[:subtree], dest)
  [ok ? :ok : :failed, target]
end

namespace :sync do
  desc "List discovered upstream sync targets"
  task :list do
    targets = upstream_targets
    if targets.empty?
      puts "No sync targets discovered."
      next
    end
    printf "%-8s %-30s %-25s %-15s %s\n", "kind", "name", "branch", "subtree", "dest"
    targets.each do |t|
      printf "%-8s %-30s %-25s %-15s %s\n",
             t[:kind], t[:name], t[:branch], t[:subtree], t[:dest_subdir]
    end
  end

  desc "Sync library docs from metanorma-{flavor} repos into software/{flavor}/docs/"
  task :libs do
    sync_kind("library")
  end

  desc "Sync model diagrams from metanorma-{flavor}-model repos into specs/{model}/{subtree}/"
  task :models do
    sync_kind("model")
  end

  desc "Delete the upstream clone cache (_upstream/)"
  task :clean do
    if File.directory?(UPSTREAM_CACHE)
      puts "Removing #{UPSTREAM_CACHE}"
      FileUtils.rm_rf(UPSTREAM_CACHE)
    else
      puts "Cache already clean."
    end
  end

  desc "Show what would be synced, without touching the filesystem"
  task :dryrun do
    ENV["DRYRUN"] = "1"
    sync_kind("library")
    sync_kind("model")
  end
end

def sync_kind(kind)
  targets = upstream_targets.select { |t| t[:kind] == kind }
  if targets.empty?
    puts "No #{kind} targets found."
    return
  end

  puts "== Syncing #{kind} (#{targets.length} target#{'s' if targets.length > 1})"
  results = targets.map do |t|
    if ENV["DRYRUN"]
      puts "  [dry-run] #{t[:name]}: would clone #{t[:repo]}@#{t[:branch]} and copy #{t[:subtree]}/ -> #{t[:dest_subdir]}/"
      next [:dryrun, t]
    end
    puts "  -> #{t[:name]}: #{t[:repo]}@#{t[:branch]} (#{t[:subtree]}/)"
    sync_target(t)
  end

  ok = results.count { |status, _| status == :ok }
  failed = results.count { |status, _| status == :failed }
  puts "  done: #{ok} synced, #{failed} failed."
  exit 1 if failed.positive?
end


# Flavor validation catalogs: the findings catalogs in the flavor gems
# (lib/metanorma/<flavor>/log.rb) are the source of truth; these tasks
# render them into the site so the documented rules can never drift
# from the code.
FLAVOR_CATALOGS = [
  { name: "ietf", repo: "https://github.com/metanorma/metanorma-ietf",
    branch: "main", require: "metanorma/ietf/log",
    constant: "Metanorma::Ietf::Converter::IETF_LOG_MESSAGES",
    layout: "ietf-flavor",
    out: "flavors/ietf/topics/validation-catalog.adoc" },
  { name: "iso", repo: "https://github.com/metanorma/metanorma-iso",
    branch: "main", require: "metanorma/iso/log",
    constant: "Metanorma::Iso::Converter::ISO_LOG_MESSAGES",
    layout: "iso-flavor",
    out: "flavors/iso/topics/validation-catalog.adoc" },
].freeze

SEVERITY_NAMES = { 0 => "abort", 1 => "serious", 2 => "not serious",
                   3 => "info" }.freeze

def ensure_catalog_clone(target)
  cache = cache_dir_for(target[:repo])
  FileUtils.mkdir_p(UPSTREAM_CACHE)
  unless File.directory?(File.join(cache, ".git"))
    ok, out = sh("git", "clone", "--depth", "1", "-b", target[:branch],
                 target[:repo], cache)
    raise "clone of #{target[:repo]} failed: #{out}" unless ok
  end
  Dir.chdir(cache) do
    # the cache may predate the https remote and a stale FETCH_HEAD
    # (a clone without a branch refspec writes the word "HEAD" there)
    ok, out = sh("git", "remote", "set-url", "origin", target[:repo])
    raise "set-url failed for #{target[:name]}: #{out}" unless ok
    ok, out = sh("git", "fetch", "--depth", "1", "origin", target[:branch])
    raise "fetch failed for #{target[:name]}: #{out}" unless ok
    ok, out = sh("git", "checkout", "FETCH_HEAD")
    raise "checkout failed for #{target[:name]}: #{out}" unless ok
  end
  cache
end

def load_catalog(target)
  cache = ensure_catalog_clone(target)
  $LOAD_PATH.unshift(File.join(cache, "lib"))
  require target[:require]
  Object.const_get(target[:constant])
end

def render_catalog(target, messages)
  cells = messages.map do |id, m|
    [id.to_s, SEVERITY_NAMES[m[:severity]], m[:category].to_s,
     m[:error].to_s].map { |c| c.gsub("|", "\\|") }
  end
  rows = cells.map { |c1, c2, c3, c4| "| #{c1} | #{c2} | #{c3} | #{c4}" }
  <<~ADOC
    ---
    layout: #{target[:layout]}
    ---

    = Validation rule catalog

    // GENERATED FILE: rendered from the metanorma-#{target[:name]} log
    // catalog (lib/metanorma/#{target[:name]}/log.rb), which is the
    // source of truth. Regenerate with `rake flavors:validation_catalog`;
    // CI fails when this file drifts.

    The severity of a finding decides what the compile does: an abort
    finding stops the compile and quarantines the invalid output; a
    serious or not-serious finding is recorded in the validation
    report; an info finding is advice. The prose for these rules is on
    the link:/flavors/#{target[:name]}/topics/content-validation/[content
    validation] page.

    [cols="2,1,2,5"]
    |===
    | Id | Severity | Category | Message

    #{rows.join("\n")}
    |===
  ADOC
end

namespace :flavors do
  desc "Render the flavor validation catalogs from the gem repos"
  task :validation_catalog do
    failures = []
    FLAVOR_CATALOGS.each do |target|
      begin
        messages = load_catalog(target)
        out = File.join(SITE_ROOT, target[:out])
        File.write(out, render_catalog(target, messages))
        puts "  -> #{target[:out]} (#{messages.size} findings)"
      rescue StandardError => e
        failures << target[:name]
        warn "  ! #{target[:name]}: #{e.message}"
      end
    end
    exit 1 unless failures.empty?
  end

  desc "Fail when the rendered catalogs drift from the gem repos"
  task :validation_catalog_check do
    failures = []
    FLAVOR_CATALOGS.each do |target|
      begin
        messages = load_catalog(target)
        out = File.join(SITE_ROOT, target[:out])
        rendered = render_catalog(target, messages)
        if File.exist?(out) && File.read(out) == rendered
          puts "  -> #{target[:out]}: in sync"
        else
          failures << target[:name]
          warn "  ! #{target[:out]}: drifted; run `rake flavors:validation_catalog`"
        end
      rescue StandardError => e
        failures << target[:name]
        warn "  ! #{target[:name]}: #{e.message}"
      end
    end
    exit 1 unless failures.empty?
  end
end

desc "Sync all upstream content (library docs + model diagrams)"
task sync: %w[sync:libs sync:models]


task default: :sync
