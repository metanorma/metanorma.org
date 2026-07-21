# frozen_string_literal: true

require "bundler/setup"

require "coradoc"
require "coradoc/asciidoc"
require "coradoc/mirror"

# Keep parser diagnostics out of the spec output (mirrors convert-adoc.rb).
Parslet::Logger.instance.level = Logger::FATAL if defined?(Parslet::Logger)

# Load the converter library through its entrypoint (autoload wiring).
# The CLI shim scripts/convert-adoc.rb itself is NOT loaded here — it
# executes a full site conversion on require.
require_relative "../scripts/convert"

RSpec.configure do |config|
  config.disable_monkey_patching!
  config.expect_with :rspec do |expectations|
    expectations.syntax = :expect
  end
  # Project rule: never use double(). Use real instances or Struct.new,
  # and Dir.mktmpdir for filesystem-touching code. `:nothing` removes the
  # mocking framework entirely so the rule is enforced mechanically.
  config.mock_with :nothing
end
