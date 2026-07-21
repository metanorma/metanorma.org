# frozen_string_literal: true

module Convert
  # The outcome of converting one source file (or synthesizing one hub
  # page): envelope data ready for EnvelopeStore#write, a per-file error,
  # or nothing (an empty hub with no children and no description).
  class Conversion
    attr_reader :output_key, :data, :error

    # data is the Rendering result hash (title, mirror_json, frontmatter,
    # frontmatter_yaml, source) or nil; it may carry an :error key.
    def initialize(output_key:, data: nil)
      @output_key = output_key
      @data = data
      @error = data && data[:error]
    end

    def success?
      !data.nil? && error.nil?
    end

    # convert_file produced nothing at all (empty hub).
    def empty?
      data.nil?
    end
  end
end
