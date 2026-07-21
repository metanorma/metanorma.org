# frozen_string_literal: true

module ExtractAttributes
  # Cross-checks the raw-line extraction against the coradoc AST: the
  # parser's own view of definition-list terms (attribute entries) and
  # their nested lists (enum values). Differences are reported, not fatal —
  # the raw pass recovers constructs coradoc drops or mis-parses on these
  # pages (anchors on term lines, the `:approval-workgroup::` typo entry,
  # unfenced `[example]` blocks, value lists orphaned from their entry).
  class AstCrosscheck
    Item = Struct.new(:raw_term, :key, :values, keyword_init: true) do
      def attribute_shaped?
        raw_term.strip.start_with?(":")
      end
    end

    def initialize(document)
      @items = []
      collect_items(document, @items)
    end

    # All DefinitionItem nodes in document order.
    def collect_items(node, acc)
      if node.is_a?(Coradoc::CoreModel::DefinitionItem)
        raw_term = node.term.to_s
        # AST terms have backticks stripped; multi-name terms may follow the
        # first name with `,` or space. Take the first whitespace-delimited
        # token (keeps `{en,fr}` brace groups intact), sans trailing comma.
        first = raw_term[/`([^`]+)`/, 1] ||
                raw_term.strip.split(/\s/).first.to_s.sub(/,\z/, "")
        nested = node.nested ? node.nested.items.map { |i| TermParser.clean_name(i.term.to_s) } : []
        acc << Item.new(raw_term: raw_term, key: TermParser.clean_name(first),
                        values: nested)
        return acc
      end
      children = []
      children.concat(node.children) if node.respond_to?(:children) && node.children.is_a?(Array)
      children.concat(node.items) if node.respond_to?(:items) && node.items.is_a?(Array)
      children.each { |c| collect_items(c, acc) }
      acc
    end

    # Compare extracted entries against the AST items. Returns an array of
    # human-readable difference lines (empty = perfect match).
    def compare(extracted_keys, extracted_values)
      lines = []
      ast_attr_items = @items.select(&:attribute_shaped?)
      ast_keys = ast_attr_items.map(&:key)
      # An AST item whose cleaned key matches an extracted key counts as
      # found even when the raw term was not colon-led (e.g. the no-colon
      # `svg-conform-profile` entry).
      only_mine = extracted_keys - ast_keys
      only_ast = ast_keys - extracted_keys
      if only_mine.any?
        lines << "entries only in raw extraction (recovered by raw pass): #{only_mine.uniq.join(', ')}"
      end
      if only_ast.any?
        lines << "entries only in coradoc AST (check for misses): #{only_ast.uniq.join(', ')}"
      end

      ast_attr_items.each do |item|
        next if item.values.empty?

        mine = extracted_values[item.key] || []
        missing = item.values - mine
        if missing.any?
          lines << "values missing for #{item.key}: ast has #{missing.inspect}, extracted=#{mine.inspect}"
        end
      end
      lines
    end
  end
end
