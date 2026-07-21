# frozen_string_literal: true

# Regression specs for definition-list continuation parsing. The bugs
# (list splitting after `+`-attached blocks; `+` unable to attach lists)
# were fixed upstream in coradoc-adoc's parser
# (~/src/mn/coradoc/coradoc-adoc parser/list.rb, > 2.0.31); these specs
# guard the behavior the site's content relies on: nested values
# (`:::`/`::::`) belong inside the parent item, subsequent `::`
# attributes stay at the top level.
RSpec.describe "definition list continuation parsing" do
  def dlists_of(node, acc = [])
    acc << node if node.class.name.end_with?("DefinitionList")
    node.instance_variables.each do |iv|
      v = node.instance_variable_get(iv)
      (v.is_a?(Array) ? v : [v]).each do |c|
        dlists_of(c, acc) if c.respond_to?(:instance_variables)
      end
    end
    acc
  end

  def top_level_lists(src)
    doc = Coradoc.parse(src, format: :asciidoc)
    doc.children.select { |c| c.class.name.end_with?("DefinitionList") }
  end

  it "keeps values nested after a `+`-attached NOTE (the IEC pattern)" do
    lists = top_level_lists(<<~ADOC)
      `:doctype:`:: type of document.
      +
      NOTE: Unlike ISO.

      `international-standard`::: International Standard
      `technical-specification`::: Technical Specification

      `:function:`:: function of document.
      `emc`::: EMC
    ADOC

    # ONE top-level list: doctype (with nested values + attached NOTE)
    # and function (with its own nested value) side by side.
    expect(lists.size).to eq(1)
    items = lists.first.items
    expect(items.map(&:term)).to eq([":doctype:", ":function:"])
    doctype = items.first
    expect(doctype.nested.items.map(&:term)).to eq(%w[international-standard technical-specification])
    expect(doctype.attached_children.size).to eq(1)
    expect(items.last.nested.items.map(&:term)).to eq(%w[emc])
  end

  it "nests `::::` values two levels deep" do
    lists = top_level_lists(<<~ADOC)
      `:a:`:: first.
      `x`::: X
      `x1`:::: X-one
      `y`::: Y
    ADOC

    x = lists.first.items.first.nested.items.first
    expect(x.term).to eq("x")
    expect(x.nested.items.map(&:term)).to eq(%w[x1])
  end

  it "does not merge lists separated by a paragraph" do
    lists = top_level_lists(<<~ADOC)
      `:a:`:: first.

      A paragraph between the lists.

      `:b:`:: second.
    ADOC

    expect(lists.size).to eq(2)
    expect(lists.first.items.map(&:term)).to eq([":a:"])
    expect(lists.last.items.map(&:term)).to eq([":b:"])
  end

  it "keeps multi-attribute lists intact when only some items have nested values" do
    lists = top_level_lists(<<~ADOC)
      `:one:`:: first attribute.
      `:two:`:: second attribute.
      `v1`::: value one
      `v2`::: value two
      `:three:`:: third attribute.
    ADOC

    expect(lists.size).to eq(1)
    expect(lists.first.items.map(&:term)).to eq([":one:", ":two:", ":three:"])
    expect(lists.first.items[1].nested.items.map(&:term)).to eq(%w[v1 v2])
  end

  it "keeps a `+`-prefixed values run in the current list (the IEEE pattern)" do
    lists = top_level_lists(<<~ADOC)
      `:document-scheme:`:: The document scheme.
      +
      Accepted values:
      +
      `ieee-sa-2021`::: (default)

      `:program:`:: Program under which a white paper was authored.
    ADOC

    expect(lists.size).to eq(1)
    expect(lists.first.items.map(&:term)).to eq([":document-scheme:", ":program:"])
    scheme = lists.first.items.first
    expect(scheme.nested.items.map(&:term)).to eq(%w[ieee-sa-2021])
    expect(scheme.attached_children.size).to eq(1)
  end

  it "attaches a bullet list to a dd with `+`" do
    lists = top_level_lists(<<~ADOC)
      `ieee-sa-2021`::: (default)
      +
      * A "Word usage" subclause will be supplied.
      * The "Participants" clause will be generated.
    ADOC

    item = lists.first.items.first
    expect(item.term).to eq("ieee-sa-2021")
    expect(item.attached_children.size).to eq(1)
  end
end
