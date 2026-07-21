# frozen_string_literal: true

module ExtractAttributes
  # Tracks AsciiDoc delimited-block fences while scanning lines, so that
  # fence contents are never mistaken for headings, term lines, or anchors
  # (e.g. the `[source,adoc]` sample inside an xrefstyle example contains a
  # literal `[[my-anchor]]` line and `=== My title` heading).
  module Fences
    FENCE_LINES = %w[---- ==== -- ____ **** ++++ .... |===].freeze

    module_function

    # The fence opened/closed by this line, or nil. `====` and friends are
    # exact-match-only (a `=== Title` heading is not a fence).
    def fence_marker(line)
      stripped = line.strip
      FENCE_LINES.find { |f| stripped == f }
    end

    # Yard-style iterator: yields [line, inside_fence?] for each line;
    # fence marker lines themselves are yielded with inside_fence? true.
    def each_with_fence_state(lines)
      open = nil
      lines.each do |line|
        marker = fence_marker(line)
        if open
          yield line, true
          open = nil if marker == open
        elsif marker
          yield line, true
          open = marker
        else
          yield line, false
        end
      end
    end
  end
end
