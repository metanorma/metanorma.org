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

desc "Sync all upstream content (library docs + model diagrams)"
task sync: %w[sync:libs sync:models]

task default: :sync
