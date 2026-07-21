#!/usr/bin/env ruby
# frozen_string_literal: true

# CLI shim for the adoc → mirror-json converter. All logic lives in the
# Convert object model under scripts/convert/ (loaded via scripts/convert.rb).

require "bundler/setup"

$stderr.sync = true

require_relative "convert"

exit(Convert::Converter.new(force: ARGV.include?("--clean")).run)
