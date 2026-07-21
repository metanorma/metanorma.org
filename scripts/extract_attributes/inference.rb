# frozen_string_literal: true

module ExtractAttributes
  # Field inference: type, default, required, deprecated — derived from the
  # entry text only (never invented).
  module Inference
    ADDED_IN_RE = /\[added in\s+(?:https:\/\/github\.com\/metanorma\/([^\/\s\]]+)\/releases\/tag\/([^\s\]]+)|(v\d[^\s\]]*))\s*\]/.freeze

    DEFAULT_PATTERNS = [
      /[Dd]efaults?\s+to\s+`([^`]+)`/,
      /[Dd]efault\s+value\s+(?:is\s+)?`([^`]+)`/,
      /\(default:\s*`([^`]+)`\)/,
      /[Dd]efault:\s*`([^`]+)`/,
      /[Bb]y\s+default\s+this\s+is\s+`([^`]+)`/,
      /[Dd]efaults?\s+to\s+(true|false|\d+)\b/,
      /[Dd]efault\s+value\s+is\s+(true|false|\d+)\b/,
      /\(default:\s*(\d+)\)/,
    ].freeze

    COMMA_LIST_RE = /comma[-\s]delimited|semicolon[-\s]delimited|comma[-\s]separated|delimited by `?comma|comma \+ space/i.freeze
    BOOLEAN_RE = /`true`,?\s*(?:or|\/|,)\s*`false`|`true`\s+or\s+`false`|\bBoolean\b/i.freeze
    FLAG_RE = /\bIf set\b|\bIf present\b|No attribute value needed|\bWhether to\b/i.freeze

    module_function

    # enum (values present, unless the prose signals a delimited list) >
    # boolean > integer/number > uri > date > comma-list > string.
    # The task's comma-list override for delimited-list prose is applied
    # first so it beats enum, per the mapping rules.
    def infer_type(key, description, values)
      text = [description, *values.map { |v| v["description"] }].compact.join("\n")
      return "comma-list" if text.match?(COMMA_LIST_RE)
      return "enum" if values.any?
      return "boolean" if text.match?(BOOLEAN_RE) || description.to_s.match?(FLAG_RE)
      return "integer" if text.match?(/\binteger\b/i)
      return "uri" if key.match?(/(?:\A|[-_])ur[il]\z/i) || text.match?(/\bAccepts a UR[IL]\b/)
      return "date" if key.match?(/(?:\A|[-_])date\}?\z|\Arevdate\z/) && text.match?(/ISO 8601|YYYY|\bdate\b/i)

      "string"
    end

    # Explicit defaults only. Checks "(default)" markers on values first,
    # then prose patterns on the description.
    def extract_default(description, values)
      marked = values.find { |v| v["description"].to_s.match?(/\((?:default|default value)\)/) }
      return marked["name"] if marked

      DEFAULT_PATTERNS.each do |re|
        m = re.match(description.to_s)
        return m[1] if m
      end
      nil
    end

    # "Mandatory" anywhere in the description, or "required" near the start
    # (later occurrences are contextual, e.g. "as is required by ISO").
    def required?(description)
      text = description.to_s
      return true if text.match?(/\bmandatory\b/i)

      head = text[0, 200]
      head.match?(/\brequired\b/i) && !head.match?(/\bnot\s+required\b/i)
    end

    def deprecated?(description, term_deprecated)
      return true if term_deprecated

      description.to_s[0, 300].match?(/\b[Dd]eprecated\b/) ? true : nil
    end

    # All `[added in <url>]` (and bare `[added in vX]`) macros in a text.
    # Returns [stripped_text, [{component, version}, ...]] in reading order.
    def extract_added_in(text, gem_name)
      found = []
      stripped = text.gsub(ADDED_IN_RE) do
        component = Regexp.last_match(1) || gem_name
        version = Regexp.last_match(2) || Regexp.last_match(3)
        found.push({ "component" => component, "version" => version })
        ""
      end
      # Tidy artefacts of mid-sentence macro removal: "word ." -> "word.",
      # and any trailing whitespace the removal left behind.
      stripped = stripped.gsub(/ +\./, ".").gsub(/ +,/, ",")
      stripped = stripped.gsub(/[ \t]+$/, "").strip
      [stripped, found]
    end
  end
end
