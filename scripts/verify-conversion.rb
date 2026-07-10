#!/usr/bin/env ruby
# frozen_string_literal: true

require "yaml"
require "set"

SITE_ROOT = File.expand_path("..", __dir__)
OUTPUT_DIR = File.join(SITE_ROOT, "pages")

MAPPING = {
  "_pages" => {
    "install.adoc" => "install/index",
    "flavors.adoc" => "flavors/index",
    "docs.adoc" => "docs/index",
    "author.adoc" => "author/index",
    "develop.adoc" => "develop/index",
    "developer.adoc" => "develop/index",
    "learn.adoc" => "learn/index",
    "contribute.adoc" => "contribute/index",
    "reference_docs.adoc" => "reference/index",
    "software.html" => nil,
    "blog.html" => nil,
    "samples.html" => nil,
    "specs.html" => nil,
    "vcard-format-specification-rendered.html" => nil,
  }
}

def extract_blog_slug(filename)
  if filename =~ /\A(\d{4})-(\d{2})-(\d{2})-(.+)\.adoc\z/
    { year: $1, month: $2, day: $3, slug: $4 }
  end
end

def map_output_path(source_dir, filename)
  rel_dir = source_dir.sub("#{SITE_ROOT}/", "")
  case rel_dir
  when "_pages"
    mapping = MAPPING["_pages"]
    mapped = mapping[filename]
    return nil if mapped.nil?
    return mapped
  when %r{_pages/(.+)}
    subdir = $1
    base = filename.sub(/\.(adoc|html)\z/, "")
    return "#{subdir}/#{base}"
  when "_posts"
    info = extract_blog_slug(filename)
    return nil unless info
    return "blog/#{info[:year]}/#{info[:month]}/#{info[:day]}/#{info[:slug]}"
  when "author"
    base = filename.sub(/\.adoc\z/, "")
    return "author/#{base}"
  when %r{author/(.+)}
    subdir = $1
    base = filename.sub(/\.adoc\z/, "")
    return "author/#{subdir}/#{base}"
  when "develop"
    base = filename.sub(/\.adoc\z/, "")
    return "develop/#{base}"
  when %r{develop/(.+)}
    subdir = $1
    base = filename.sub(/\.adoc\z/, "")
    return "develop/#{subdir}/#{base}"
  when "learn"
    base = filename.sub(/\.adoc\z/, "")
    return "learn/#{base}"
  when %r{learn/(.+)}
    subdir = $1
    base = filename.sub(/\.adoc\z/, "")
    return "learn/#{subdir}/#{base}"
  when "reference_docs"
    base = filename.sub(/\.(adoc|html)\z/, "")
    return "reference/#{base}"
  when "_software"
    base = filename.sub(/\.adoc\z/, "")
    return "software/#{base}"
  when %r{_software/(.+)}
    subdir = $1
    base = filename.sub(/\.adoc\z/, "")
    return "software/#{subdir}/#{base}"
  when "_specs"
    base = filename.sub(/\.adoc\z/, "")
    return "specs/#{base}"
  when %r{_specs/(.+)}
    subdir = $1
    base = filename.sub(/\.adoc\z/, "")
    return "specs/#{subdir}/#{base}"
  when "_samples"
    base = filename.sub(/\.adoc\z/, "")
    return "samples/#{base}"
  when %r{_samples/(.+)}
    subdir = $1
    base = filename.sub(/\.adoc\z/, "")
    return "samples/#{subdir}/#{base}"
  else
    base = filename.sub(/\.(adoc|html)\z/, "")
    return "#{rel_dir}/#{base}"
  end
end

def strip_frontmatter(text)
  text.sub(/\A---\n.*?---\n/m, "")
end

def parse_frontmatter(text)
  m = text.match(/\A---\n(.*?)\n---\n/m)
  return {} unless m
  YAML.safe_load(m[1], permitted_classes: [Date, Time]) || {}
rescue StandardError
  {}
end

def collect_source_files
  patterns = [
    "author/**/*.adoc",
    "_posts/**/*.adoc",
    "develop/**/*.adoc",
    "learn/**/*.adoc",
    "reference_docs/**/*.adoc",
    "_software/**/*.adoc",
    "_specs/**/*.adoc",
    "_samples/**/*.adoc",
    "_pages/**/*.adoc",
    "_pages/**/*.html",
  ]
  files = []
  patterns.each do |pattern|
    Dir.glob(File.join(SITE_ROOT, pattern)).each do |f|
      next if f.include?("AGENTS.md")
      files << f
    end
  end
  files.sort
end

def extract_links_adoc(text)
  links = Set.new
  text.gsub(/link:(\S+?)\[([^\]]*)\]/) { links << $1 }
  text.gsub(/https?:\/\/[^\s\]]+/) { |m| links << m }
  text.gsub(/image::?(\S+?)\[/) { |l| links << "image:#{l}" }
  links
end

def extract_links_md(text)
  links = Set.new
  text.gsub(/\[([^\]]*)\]\(([^)]+)\)/) { links << $2 }
  text.gsub(/https?:\/\/[^\s)]+/) { |m| links << m }
  links
end

def extract_headings_adoc(text)
  body = strip_frontmatter(text)
  headings = []
  body.scan(/^(={1,6})\s+(.+)$/) do |level, title|
    headings << { level: level.length, title: title.strip }
  end
  headings
end

def extract_headings_md(text)
  body = text.sub(/\A---\n.*?\n---\n/m, "")
  headings = []
  body.scan(/^(\#{1,6})\s+(.+)$/) do |hashes, title|
    headings << { level: hashes.length, title: title.strip }
  end
  headings
end

def extract_code_blocks_adoc(text)
  blocks = []
  body = strip_frontmatter(text)
  body.scan(/\[source([^\]]*)\]\n--+\n(.*?)\n--+/m) { blocks << $2.strip }
  body.scan(/```\n(.*?)\n```/m) { blocks << $1.strip }
  body.scan(/----\n(.*?)\n----/m) { blocks << $1.strip }
  blocks
end

def extract_code_blocks_md(text)
  blocks = []
  body = text.sub(/\A---\n.*?\n---\n/m, "")
  body.scan(/```[a-z]*\n(.*?)\n```/m) { blocks << $1.strip }
  blocks
end

def check_encoding(text, path)
  issues = []
  unless text.valid_encoding?
    issues << "invalid UTF-8 encoding"
  end
  if text.include?("\u{FFFD}")
    count = text.count("\u{FFFD}")
    issues << "#{count} replacement character(s) (U+FFFD)"
  end
  mojibake_patterns = [
    /Ã¢/, /Ã©/, /Ã¨/, /Ã¼/, /Ã¶/, /Ã„/, /Ã–/, /Ãœ/, /ÃŸ/,
    /Â§/, /Â°/, /â€/, /â€œ/, /â€�/, /Â/
  ]
  mojibake_patterns.each do |pat|
    if pat.match?(text)
      issues << "mojibake detected (#{pat.source})"
    end
  end
  issues
end

def check_raw_adoc_syntax(text, path)
  body = text.sub(/\A---\n.*?\n---\n/m, "")
  issues = []

  # Should not have AsciiDoc section markers (== or === at line start in body)
  # But == could legitimately appear in code blocks, so be lenient
  # Check for |=== table delimiters outside code blocks
  code_blocks = []
  body.gsub(/```[^\n]*```/) { |m| code_blocks << m }
  body.gsub(/```[a-zA-Z]*\n.*?\n```/m) { |m| code_blocks << m }
  body_without_code = body.dup
  code_blocks.each { |cb| body_without_code.sub!(cb, "") }

  if body_without_code =~ /^\s*\|===/m
    issues << "raw AsciiDoc table delimiter |=== found outside code block"
  end

  issues
end

def check_frontmatter_valid(md_text, path)
  issues = []
  unless md_text.start_with?("---\n")
    issues << "missing frontmatter opening delimiter"
    return issues
  end

  fm_match = md_text.match(/\A---\n(.*?)\n---\n/m)
  unless fm_match
    issues << "malformed frontmatter (no closing delimiter)"
    return issues
  end

  begin
    fm = YAML.safe_load(fm_match[1])
    unless fm.is_a?(Hash)
      issues << "frontmatter is not a YAML mapping (got #{fm.class})"
    end
  rescue => e
    issues << "frontmatter YAML parse error: #{e.message}"
  end

  issues
end

def extract_words(text)
  body = strip_frontmatter(text)
  body.gsub!(/```[^\n]*```/, " ")
  body.gsub!(/```[a-zA-Z]*\n.*?\n```/m, " ")
  body.gsub!(/\[source[^\]]*\]\n(-+)\n.*?\n\1/m, " ")
  body.gsub!(/\[source[^\]]*\]/, " ")
  body.gsub!(/^[-+*=]+\s*$/m, " ")
  body.gsub!(/\|===/, " ")
  body.downcase.gsub(/[^a-z0-9\s]/, " ").split.reject { |w| w.length < 3 }
end

def verify_pair(adoc_path, md_path)
  issues = []
  warnings = []

  unless File.exist?(md_path)
    return { issues: ["output .md file does not exist"], warnings: [] }
  end

  adoc_text = File.read(adoc_path, encoding: "UTF-8")
  md_text = File.read(md_path, encoding: "UTF-8")

  issues.concat(check_encoding(md_text, md_path).map { |i| "encoding: #{i}" })
  issues.concat(check_frontmatter_valid(md_text, md_path).map { |i| "frontmatter: #{i}" })
  issues.concat(check_raw_adoc_syntax(md_text, md_path).map { |i| "syntax: #{i}" })

  src_fm = parse_frontmatter(adoc_text)
  out_fm_raw = md_text.match(/\A---\n(.*?)\n---\n/m)
  out_fm = out_fm_raw ? (YAML.safe_load(out_fm_raw[1]) || {}) : {}

  unless out_fm["title"]
    issues << "frontmatter: title missing"
  end
  if src_fm["title"] && out_fm["title"] && src_fm["title"].to_s != out_fm["title"].to_s
    src_t = src_fm["title"].to_s.strip
    out_t = out_fm["title"].to_s.strip
    if src_t.downcase != out_t.downcase
      warnings << "title differs: src='#{src_t[0..60]}' out='#{out_t[0..60]}'"
    end
  end

  if src_fm["date"] || adoc_path.include?("/_posts/")
    unless out_fm["date"]
      warnings << "date missing in output (src has date or is blog post)"
    end
  end

  src_has_author = src_fm["author"] || src_fm["authors"]
  if src_has_author && !out_fm["author"]
    warnings << "author missing in output (src has author/authors)"
  end

  if src_fm["categories"] && !out_fm["categories"]
    warnings << "categories missing in output"
  end

  if src_fm["excerpt"] && !out_fm["excerpt"]
    warnings << "excerpt missing in output"
  end

  if src_fm["redirect_from"] && !out_fm["redirect_from"]
    warnings << "redirect_from missing in output"
  end

  src_headings = extract_headings_adoc(adoc_text)
  out_headings = extract_headings_md(md_text)

  if src_headings.any?
    ratio = out_headings.length.to_f / src_headings.length
    if ratio < 0.5
      warnings << "heading count dropped significantly: src=#{src_headings.length} out=#{out_headings.length}"
    end
  end

  src_links = extract_links_adoc(adoc_text)
  out_links = extract_links_md(md_text)

  src_urls = src_links.select { |l| l =~ /^https?:\/\// }
  src_urls.each do |url|
    base_url = url.sub(/\].*$/, "").sub(/\[.*$/, "")
    unless md_text.include?(base_url)
      warnings << "external URL missing in output: #{base_url[0..60]}"
    end
  end

  src_words = extract_words(adoc_text)
  out_words = extract_words(md_text)

  if src_words.length > 50
    src_set = Set.new(src_words)
    out_set = Set.new(out_words)
    missing = src_set - out_set
    missing_ratio = missing.length.to_f / src_set.length
    if missing_ratio > 0.3
      issues << "content loss: #{missing.length}/#{src_set.length} unique words missing (#{(missing_ratio * 100).round}% loss)"
    elsif missing_ratio > 0.15
      warnings << "content check: #{missing.length}/#{src_set.length} unique words missing (#{(missing_ratio * 100).round}% loss)"
    end
  end

  { issues: issues, warnings: warnings, src_words: src_words.length, out_words: out_words.length }
end

source_files = collect_source_files

stats = { total: 0, checked: 0, skipped: 0, no_output: 0 }
all_issues = {}
all_warnings = {}

source_files.each do |adoc_path|
  stats[:total] += 1
  filename = File.basename(adoc_path)
  source_dir = File.dirname(adoc_path)
  output_key = map_output_path(source_dir.sub("#{SITE_ROOT}/", ""), filename)

  if output_key.nil?
    stats[:skipped] += 1
    next
  end

  adoc_text = File.read(adoc_path, encoding: "UTF-8")
  body = strip_frontmatter(adoc_text)
  if body.strip.empty?
    stats[:skipped] += 1
    next
  end

  md_path = File.join(OUTPUT_DIR, "#{output_key}.md")
  result = verify_pair(adoc_path, md_path)

  if result[:issues].include?("output .md file does not exist")
    stats[:no_output] += 1
    all_issues[adoc_path.sub(SITE_ROOT + "/", "")] = result[:issues]
    next
  end

  stats[:checked] += 1

  if result[:issues].any?
    all_issues[adoc_path.sub(SITE_ROOT + "/", "")] = result[:issues]
  end
  if result[:warnings].any?
    all_warnings[adoc_path.sub(SITE_ROOT + "/", "")] = result[:warnings]
  end
end

puts "=" * 80
puts "VERIFICATION REPORT"
puts "=" * 80
puts ""
puts "Source files scanned: #{stats[:total]}"
puts "Pairs verified:       #{stats[:checked]}"
puts "Skipped (layout/nil): #{stats[:skipped]}"
puts "Missing output:       #{stats[:no_output]}"
puts ""
puts "=" * 80
puts "HARD ISSUES (encoding, frontmatter, syntax, content loss): #{all_issues.values.flatten.length}"
puts "=" * 80

if all_issues.any?
  all_issues.each do |path, issues|
    puts ""
    puts "  #{path}:"
    issues.each { |i| puts "    ❌ #{i}" }
  end
else
  puts "  ✅ No hard issues found"
end

puts ""
puts "=" * 80
puts "WARNINGS (potential content/formatting concerns): #{all_warnings.values.flatten.length}"
puts "=" * 80

if all_warnings.any?
  shown = 0
  all_warnings.each do |path, warnings|
    break if shown >= 50
    puts ""
    puts "  #{path}:"
    warnings.each { |w| puts "    ⚠️  #{w}" }
    shown += 1
  end
  remaining = all_warnings.keys.length - shown
  puts "" if remaining > 0
  puts "  ... and #{remaining} more files with warnings" if remaining > 0
else
  puts "  ✅ No warnings"
end

puts ""
puts "=" * 80
puts "SUMMARY"
puts "=" * 80
issue_files = all_issues.length
warn_files = all_warnings.length
clean = stats[:checked] - issue_files - warn_files
puts "  Clean pairs:      #{clean}/#{stats[:checked]}"
puts "  Warning-only:     #{warn_files}/#{stats[:checked]}"
puts "  Hard issues:      #{issue_files}/#{stats[:checked]}"
puts ""
exit(all_issues.empty? ? 0 : 1)
