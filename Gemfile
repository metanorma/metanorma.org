source "https://rubygems.org"

# Coradoc gemsuite — used by scripts/convert-adoc.rb to transform .adoc
# sources into mirror-json envelopes. The core gem provides the pipeline;
# coradoc-adoc provides the AsciiDoc parser; coradoc-mirror provides the
# mirror-json transformer. coradoc-adoc >= 2.0.32 carries the
# definition-list continuation fix (parser/list.rb).
gem "coradoc"
gem "coradoc-adoc", ">= 2.0.32"
gem "coradoc-mirror"

# Rake tasks for syncing upstream content (library/model repos).
gem "rake"

group :development, :test do
  # Spec suite for the converter (scripts/convert/*) — the URL/redirect
  # safety net. Run with `bundle exec rspec`.
  gem "rspec", "~> 3.13"
end
