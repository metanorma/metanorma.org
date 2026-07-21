# frozen_string_literal: true

module ExtractAttributes
  # Splits a source page's body lines into an ordered event stream:
  #   { type: :intro_prose, lines: }            before the first heading
  #   { type: :section, level:, title:, anchor: }
  #   { type: :prose, lines: }                  section-level prose
  #   { type: :entry, term_line:, body_lines:, line_no: }
  #
  # An entry owns every line up to the next attribute term line or heading.
  # A `[[anchor]]` line immediately before a term or heading attaches to it.
  class Segmenter
    HEADING_RE = /\A(={2,6})\s+(.+?)\s*\z/.freeze
    ANCHOR_RE = /\A\[\[([^\]]+)\]\]\s*\z/.freeze

    Event = Struct.new(:type, :lines, :level, :title, :anchor,
                       :term_line, :body_lines, :line_no, keyword_init: true)

    attr_reader :events, :dropped_duplicate_terms, :dropped_comments

    def initialize(body_lines)
      @lines = body_lines
      @events = []
      @dropped_duplicate_terms = []
      @dropped_comments = 0
      segment
    end

    private

    def segment
      context = :intro
      prose = []
      entry = nil
      pending_anchor = nil
      open_fence = nil

      flush_prose = lambda do
        @events << Event.new(type: :prose, lines: prose) unless prose.all? { |l| l.strip.empty? }
        prose = []
      end
      flush_entry = lambda do
        @events << entry if entry
        entry = nil
      end

      @lines.each_with_index do |line, idx|
        stripped = line.strip

        # Fence contents are literal text: never headings, terms, anchors.
        if open_fence
          (context == :entry ? entry[:body_lines] : prose) << line
          open_fence = nil if Fences.fence_marker(line) == open_fence
          next
        end
        if (marker = Fences.fence_marker(line))
          open_fence = marker
          (context == :entry ? entry[:body_lines] : prose) << line
          next
        end

        # Comment lines are invisible content (including commented-out
        # pseudo-entries like IETF v3's `// `:compact:`::`): skipped here.
        if stripped.start_with?("//")
          @dropped_comments += 1
          next
        end

        if (anchor = ANCHOR_RE.match(stripped))
          flush_prose.call
          pending_anchor = anchor[1]
          next
        end

        if (heading = HEADING_RE.match(line))
          flush_prose.call
          flush_entry.call
          @events << Event.new(type: :section, level: heading[1].length - 1,
                               title: heading[2], anchor: pending_anchor)
          pending_anchor = nil
          context = :prose
          next
        end

        if TermParser.attribute_term?(line, entry_position: context != :entry)
          flush_prose.call
          if entry && duplicate_term_line?(entry, line)
            @dropped_duplicate_terms << line.strip
            next
          end
          flush_entry.call
          term_line = pending_anchor ? "[[#{pending_anchor}]] #{line.strip}" : line
          entry = Event.new(type: :entry, term_line: term_line,
                            body_lines: [], line_no: idx + 1)
          pending_anchor = nil
          context = :entry
          next
        end

        if pending_anchor
          # An anchor not attached to a term/heading (e.g. the page-level
          # anchor above the intro note) stays as prose content.
          prose << "[[#{pending_anchor}]]"
          pending_anchor = nil
        end

        if context == :entry
          entry[:body_lines] << line
        else
          prose << line
        end
      end

      flush_prose.call
      flush_entry.call

      # Leading prose becomes :intro_prose (it precedes the first section).
      first_section = @events.index { |e| e.type == :section }
      @events = @events.each_with_index.map do |ev, i|
        if ev.type == :prose && (first_section.nil? || i < first_section)
          Event.new(type: :intro_prose, lines: ev.lines)
        else
          ev
        end
      end
    end

    # A repeated identical term line with no dd content yet (seen on the
    # v2 page: `` `:rfcedstyle:`:: `` written twice in a row).
    def duplicate_term_line?(entry, line)
      return false unless entry[:body_lines].all? { |l| l.strip.empty? }

      have = TermParser.analyze(entry[:term_line])
      want = TermParser.analyze(line)
      have && want && have[:key] == want[:key]
    end
  end
end
