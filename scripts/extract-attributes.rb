#!/usr/bin/env ruby
# frozen_string_literal: true

# CLI shim for the attribute-manifest extractor. All logic lives in the
# ExtractAttributes object model under scripts/extract_attributes/
# (loaded via scripts/extract_attributes.rb).
#
# Usage:
#   bundle exec ruby scripts/extract-attributes.rb [flavor...]
# flavors: standoc iso ietf ietf-v2 (default: all four)

require "bundler/setup"

$stderr.sync = true

require_relative "extract_attributes"

keys = ARGV.empty? ? ExtractAttributes::PAGES.keys : ARGV
unknown = keys - ExtractAttributes::PAGES.keys
abort("unknown flavor(s): #{unknown.join(', ')} (known: #{ExtractAttributes::PAGES.keys.join(', ')})") if unknown.any?

Parslet::Logger.instance.level = Logger::FATAL if defined?(Parslet::Logger)

ExtractAttributes::Runner.new.run(keys)
