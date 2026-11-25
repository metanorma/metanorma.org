source "https://rubygems.org"

# Ceradoc gemsuite — used by scripts/convert-adoc.rb to transform .adoc
# sources into mirror-json envelopes. The core gem provides the pipeline;
# ceradoc-adoc provides the AsciiDoc parser; ceradoc-mirror provides the
# mirror-json transformer. ceradoc-adoc >= 2.0.32 carries the
# definition-list continuation fix (parser/list.rb).
gem "ceradoc", "~> 3.0"
gem "ceradoc-adoc", ">= 2.0.32"
gem "ceradoc-mirror", "~> 0.1"

# Rake tasks for syncing upstream content (library/model repos).
gem "rake"

group :development, :test do
  # Spec suite for the converter (scripts/convert/*) — the URL/redirect
  # safety net. Run with `bundle exec rspec`.
  gem "rspec", "~> 3.13"
end
