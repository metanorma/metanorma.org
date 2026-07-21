# frozen_string_literal: true

module ExtractAttributes
  # Parses definition-list term lines into attribute name records.
  #
  # Tolerated shapes (all seen on the four source pages):
  #   `:name:`::                       plain
  #   `name`::                         no colons (e.g. `svg-conform-profile`)
  #   `:name`::                        missing trailing colon (IETF `:name`)
  #   `:approval-workgroup::`::        source typo (double colon in name)
  #   `:a:`, `:b:`::                   multi-name (aliases or grouped entries)
  #   `:x:` (legacy: `:mn-x:`)::       legacy names
  #   `:x:` (legacy: x)::              legacy names without colons
  #   `:x:` (DEPRECATED)::             deprecated marker
  #   [[anchor]] `:x:`::               same-line anchor
  #   `= Document Title`::             AsciiDoc title as an attribute (v2)
  module TermParser
    # A term line ends with `::` (single definition marker) — value lines
    # end with `:::` and are handled by EntryBuilder instead.
    TERM_RE = /\A\s*(?:\[\[([^\]]+)\]\]\s*)?(.+?)::(?:\s+(.*))?\z/.freeze

    module_function

    # True when the raw line is a definition term line whose backticked
    # names mark it as an attribute term (leading colon) — or, when no
    # attribute entry is currently open (`entry_position`), any backticked
    # term (covers `svg-conform-profile` and `= Document Title`). A
    # backticked term without a leading colon inside an open entry is a
    # value line, not an attribute.
    def attribute_term?(line, entry_position:)
      return false if line.strip.include?(":::") # value definition line

      parsed = parse(line)
      return false unless parsed
      return true if parsed[:names].any? { |n| n.start_with?(":") }

      entry_position
    end

    # Parse a term line into a name record, or nil when the line is not a
    # definition term. Does not decide attribute-vs-value (see
    # {.attribute_term?}); callers use this on confirmed term lines.
    def parse(line)
      m = TERM_RE.match(line) or return nil
      anchor, term_part, rest = m.captures
      return nil unless term_part&.include?("`")

      # Split off trailing parenthesized qualifiers: (legacy: ...),
      # (DEPRECATED). Only the LAST parenthesized group before `::` is a
      # qualifier; names come from the remaining text.
      legacy = []
      deprecated = false
      names_part = term_part.dup
      if names_part.sub!(/\s*\(([^()]*)\)\s*,?\s*\z/, "")
        qualifier = Regexp.last_match(1).strip
        case qualifier
        when /\Alegacy:\s*(.+)\z/i
          legacy = Regexp.last_match(1).scan(/`([^`]+)`|([A-Za-z0-9}{_.-]+)/)
                         .map { |bt, bare| clean_name(bt || bare) }
                         .reject(&:empty?)
        when /\ADEPRECATED\z/i
          deprecated = true
        else
          # Not a qualifier — restore (it was part of the term text).
          names_part = term_part.dup
        end
      end

      names = names_part.scan(/`([^`]+)`/).flatten
      return nil if names.empty?

      {
        anchor: anchor,
        names: names, # raw, with colons
        legacy: legacy,
        deprecated: deprecated,
        rest: rest.to_s, # dd text starting on the term line
      }
    end

    # Normalize one raw backticked name into the manifest key form.
    # Returns [key, source_term_or_nil]: source_term is recorded only when
    # normalization repaired something unusual (e.g. `:approval-workgroup::`).
    def clean_name(raw)
      raw.to_s.strip.sub(/\A:+(?=\S)/, "").sub(/:+\z/, "")
    end

    # Full name analysis for a confirmed attribute term line:
    # { key:, aliases:, legacy:, deprecated:, anchor:, source_term:,
    #   grouped:, first_dd_line: }
    def analyze(line)
      parsed = parse(line) or return nil
      keys = parsed[:names].map { |n| clean_name(n) }
      source_terms = parsed[:names].zip(keys).filter_map do |raw, key|
        # Bare `name` and `:name` forms are tolerated spellings; only
        # surplus inner colons (e.g. `:approval-workgroup::`) count as
        # source typos worth recording.
        raw if raw.sub(/\A:/, "").sub(/:\z/, "") != key
      end
      {
        key: keys.first,
        other_names: keys[1..] || [],
        grouped: grouped?(keys),
        legacy: parsed[:legacy],
        deprecated: parsed[:deprecated],
        anchor: parsed[:anchor],
        source_term: source_terms.first,
        first_dd_line: parsed[:rest],
      }
    end

    # Multi-name terms sharing a long hyphenated prefix (sponsor-address,
    # sponsor-phone, ...) are grouped attributes sharing one description;
    # names that differ at the head (status/docstage, document-class/flavor)
    # are true aliases.
    def grouped?(keys)
      return false if keys.size < 2

      head = keys.first.split("-").first
      head.length >= 3 && keys.all? { |k| k == head || k.start_with?("#{head}-") }
    end

    # `{_i}` / `_{1}` / `[{_i}]` index markers make an attribute repeatable.
    def repeatable?(key)
      key.match?(/\{_i\}|\[_i\]|_\{\d+\}|\{\d+\}/)
    end
  end
end
