#!/usr/bin/env ruby
# frozen_string_literal: true

require "bundler/setup"

require "coradoc"
require "coradoc/asciidoc"
require "coradoc/mirror"
require "json"
require "fileutils"
require "find"
require "time"

$stderr.sync = true
Parslet::Logger.instance.level = Logger::FATAL if defined?(Parslet::Logger)

require_relative "convert/path_mapping"
require_relative "convert/rewriters"
require_relative "convert/rendering"
require_relative "convert/sources"
require_relative "convert/hub_synthesizer"

include Convert::PathMapping
include Convert::Rendering
include Convert::Sources

SITE_ROOT = Convert::PathMapping::SITE_ROOT
MIRROR_JSON_DIR = File.join(SITE_ROOT, "mirror-json")
PUBLIC_DIR = File.join(SITE_ROOT, "public")

FORCE_REBUILD = ARGV.include?("--clean")

if FORCE_REBUILD
  FileUtils.rm_rf(MIRROR_JSON_DIR)
end
FileUtils.mkdir_p(MIRROR_JSON_DIR)

# Copy non-adoc assets (images, PDFs, etc.) into public/.
copy_assets(site_root: SITE_ROOT, public_dir: PUBLIC_DIR)

source_files = collect_source_files(site_root: SITE_ROOT)

stats = { ok: 0, fail: 0, unmapped: 0, empty_hub: 0, cached: 0 }
errors = {}
file_map = {}

# Pass 1: convert each .adoc source into a mirror-json envelope.
source_files.each_with_index do |filepath, idx|
  filename = File.basename(filepath)
  source_dir = File.dirname(filepath)
  rel_path = filepath.sub("#{SITE_ROOT}/", "")

  output_key = map_output_path(source_dir.sub("#{SITE_ROOT}/", ""), filename)
  if output_key.nil?
    stats[:unmapped] += 1
    warn "  WARNING: no MAPPING entry for #{rel_path}"
    next
  end

  fm_date = begin
    fm = read_frontmatter_data(File.read(filepath))
    d = fm["date"].to_s
    d[%r{\A\d{4}-\d{2}-\d{2}}, 0]
  rescue StandardError
    nil
  end
  legacy_redirects = legacy_redirects_for(rel_path, output_key, frontmatter_date: fm_date)

  mirror_path = File.join(MIRROR_JSON_DIR, "#{output_key}.json")

  if !FORCE_REBUILD && File.exist?(mirror_path) &&
     File.mtime(mirror_path) >= File.mtime(filepath)
    stats[:cached] += 1
    file_map[output_key] = { status: "cached", source: rel_path }
    next
  end

  $stderr.printf("\r[%d/%d] %-60s", idx + 1, source_files.length, filename) if idx % 5 == 0

  result = convert_file(
    filepath, output_key,
    legacy_redirects: legacy_redirects,
    output_dir: MIRROR_JSON_DIR, site_root: SITE_ROOT, mirror_json_dir: MIRROR_JSON_DIR,
  )
  if result.nil?
    stats[:empty_hub] += 1
  elsif result[:error]
    stats[:fail] += 1
    errors[rel_path] = result[:error]
    file_map[output_key] = { status: "error", source: rel_path, error: result[:error] }
  else
    write_mirror_json(output_key, result, mirror_json_dir: MIRROR_JSON_DIR)
    stats[:ok] += 1
    file_map[output_key] = { status: "ok", source: rel_path }
  end
end

$stderr.puts

# Pass 2: Synthesize hub pages for any mirror-json directory that has
# child entries but no index entry and no sibling <dirname> entry at
# the parent level.
Find.find(MIRROR_JSON_DIR) do |path|
  next unless File.directory?(path)
  next if path == MIRROR_JSON_DIR

  rel_dir = path.sub("#{MIRROR_JSON_DIR}/", "")

  next if rel_dir =~ %r{\Ablog/\d{4}\z}

  index_json = File.join(path, "index.json")
  next if File.exist?(index_json)

  sibling_json = File.join(File.dirname(path), "#{File.basename(path)}.json")
  next if File.exist?(sibling_json)

  children = Dir.glob(File.join(path, "*.json")).reject { |f| File.basename(f) == "index.json" || File.basename(f) == "manifest.json" }.sort
  next if children.empty?

  source_rel = source_dir_for_output(rel_dir)
  title = nav_title_for(File.dirname(source_rel), File.basename(source_rel)) || File.basename(path)

  child_items = children.map do |child|
    child_base = File.basename(child, ".json")
    begin
      child_envelope = JSON.parse(File.read(child))
      child_title = child_envelope["title"].to_s.strip
    rescue StandardError
      child_title = ""
    end
    child_title = nav_title_for(source_rel, child_base) || child_title if child_title.empty?
    child_title = child_base if child_title.empty?
    { title: child_title, slug: child_base }
  end

  core = Convert::HubSynthesizer.build_document(
    title: title,
    children: child_items,
    url_prefix: rel_dir,
  )

  hub_output_key = "#{rel_dir}/index"
  result = build_result(
    core, path, hub_output_key,
    output_dir: MIRROR_JSON_DIR, site_root: SITE_ROOT, mirror_json_dir: MIRROR_JSON_DIR,
  )
  write_mirror_json(hub_output_key, result, mirror_json_dir: MIRROR_JSON_DIR)
  file_map[hub_output_key] = { status: "ok", source: "synthesized hub" }
  stats[:ok] += 1
end

# Pass 3: Synthesize model-spec diagram pages for each PNG in
# `_specs/<model>/images/`. Production serves these at
# `/specs/<model>/<CapitalizedName>/`.
MODEL_SPECS_DIR = File.join(SITE_ROOT, "_specs")
if File.directory?(MODEL_SPECS_DIR)
  Dir.glob(File.join(MODEL_SPECS_DIR, "*/images/*.png")).sort.each do |png|
    model_dir = File.dirname(File.dirname(png))
    model_name = File.basename(model_dir)
    diagram_name = File.basename(png, ".png")

    output_key = "specs/#{model_name}/#{diagram_name}"
    mirror_path = File.join(MIRROR_JSON_DIR, "#{output_key}.json")
    next if File.exist?(mirror_path)

    image_url = "/_specs/#{model_name}/images/#{diagram_name}.png"
    title = diagram_name.gsub(/([a-z])([A-Z])/, '\1 \2')

    core_children = [
      Coradoc::CoreModel::FrontmatterBlock.new(data: { "title" => title, "layout" => "page" }),
      Coradoc::CoreModel::ParagraphBlock.new(content: "Data model diagram for #{model_name}."),
      Coradoc::CoreModel::Image.new(src: image_url, alt: title),
    ]
    core = Coradoc::CoreModel::DocumentElement.build(title: title, children: core_children)

    result = build_result(
      core, png, output_key,
      legacy_redirects: [],
      output_dir: MIRROR_JSON_DIR, site_root: SITE_ROOT, mirror_json_dir: MIRROR_JSON_DIR,
    )
    write_mirror_json(output_key, result, mirror_json_dir: MIRROR_JSON_DIR)
    file_map[output_key] = { status: "ok", source: "synthesized model diagram" }
    stats[:ok] += 1
  end
end

manifest = {
  generated_at: Time.now.utc.iso8601,
  stats: stats,
  total_files: source_files.length,
  file_map: file_map,
}
File.write(File.join(MIRROR_JSON_DIR, "manifest.json"), JSON.pretty_generate(manifest))

puts "Conversion complete:"
puts "  OK: #{stats[:ok]}"
puts "  CACHED: #{stats[:cached]}"
puts "  FAIL: #{stats[:fail]}"
puts "  EMPTY-HUB: #{stats[:empty_hub]}"
puts "  UNMAPPED: #{stats[:unmapped]}"
puts "  SUPERSEDED: #{Convert::PathMapping::SUPERSEDED.size} (excluded at source collection)"
puts "  TOTAL: #{source_files.length}"
puts ""

if stats[:unmapped] > 0
  puts "WARNING: #{stats[:unmapped]} file(s) had no MAPPING entry (see warnings above)"
  puts ""
end

if stats[:fail] > 0
  puts "Errors (first 20):"
  errors.first(20).each do |f, e|
    puts "  #{f}: #{e}"
  end
  puts "  ... (#{errors.length} total errors)" if errors.length > 20
end

exit(stats[:fail] > 0 ? 1 : 0)
