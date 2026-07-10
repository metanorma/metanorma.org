# coradoc AsciiDoc→Markdown Conversion: Bug Report

**Date:** 2026-06-14
**Source corpus:** metanorma.org documentation site (452 `.adoc` files)
**Pipeline:** `.adoc` → `Coradoc.parse(text, format: :asciidoc)` → `Coradoc.serialize(core, to: :markdown)` → `.md`
**coradoc version:** HEAD of `~/src/mn/coradoc` (all `coradoc-*` gems from same monorepo)

## Summary

3 parser bugs block clean AsciiDoc→Markdown conversion. Each is confirmed with a minimal reproduction below. The metanorma.org conversion pipeline currently works around Bugs 1 and 3 with Ruby pre-processing scripts; Bug 2 has no workaround.

| Bug | Severity | Files affected | Workaround in place? |
|-----|----------|---------------|---------------------|
| 1. Definition list parser drops all content | **Critical** | 18 | Yes (strip `::` → paragraphs) |
| 2. Bare <code>&#96;&#96;&#96;</code> code blocks collapse to single line | High | 5 | No |
| 3. Context-dependent table parsing | High | All files with tables | Yes (extract tables, parse in isolation) |

---

## Bug 1: Definition list parser produces empty output

### Minimal reproduction

```ruby
require "coradoc"
require "coradoc/asciidoc"
require "coradoc/markdown"

adoc = <<~ADOC
  term one::
    Definition for term one.

  term two::
    Definition for term two.
ADOC

core = Coradoc.parse(adoc, format: :asciidoc)
puts Coradoc.serialize(core, to: :markdown)
# => (empty — all content lost)
```

**Expected:** A definition list or at minimum the term/definition text preserved as paragraphs.

**Actual:** Completely empty output. Both terms and both definitions are dropped.

### Root cause (investigated)

The AsciiDoc parser's `list_transformer.rb` `transform_definition_item` creates `Coradoc::CoreModel::DefinitionItem` objects, but they are populated with empty values:

- `term = ""`
- `definitions = [""]`
- `term_children = []` (length 0)
- `definition_children = []` (length 0)
- Items count = 1 even when source has 2+

The Markdown serializer (`coradoc-markdown/lib/coradoc/markdown/serializer.rb`, `serialize_definition_list`) is correct — it correctly accesses `DefinitionTerm#text` and `DefinitionItem#content`. The bug is in the **parser**, not the serializer.

### Files affected (18 files, full absolute paths)

```
/Users/mulgogi/src/mn/metanorma.org/_pages/install/site.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2020-06-10-upgrading-metanorma-ietf-documents-to-v2.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2024-03-31-developing-itu-t-recommendations.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2024-04-04-ogc-modspec-in-yaml.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2024-08-20-pdf-attachments.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2024-09-30-persistent-error-log.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2025-11-08-mastering-error-logging-filtering.adoc
/Users/mulgogi/src/mn/metanorma.org/author/basics/reference-lookups.adoc
/Users/mulgogi/src/mn/metanorma.org/author/basics/what.adoc
/Users/mulgogi/src/mn/metanorma.org/author/bsi/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/ieee/topics/markup.adoc
/Users/mulgogi/src/mn/metanorma.org/author/iso/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/topics/blocks/requirements-modspec.adoc
/Users/mulgogi/src/mn/metanorma.org/author/topics/blocks/tables.adoc
/Users/mulgogi/src/mn/metanorma.org/author/topics/collections/configuration.adoc
/Users/mulgogi/src/mn/metanorma.org/author/topics/metadata/history.adoc
/Users/mulgogi/src/mn/metanorma.org/author/topics/sections/bibliography.adoc
/Users/mulgogi/src/mn/metanorma.org/author/topics/sections/concepts.adoc
```

### Current workaround

Pre-processing strips trailing `::` from term lines (`term::` → `term`), converting definition lists to regular paragraphs. This preserves the text content but loses the term/definition semantic structure.

---

## Bug 2: Bare <code>&#96;&#96;&#96;</code> code blocks collapse to single line

### Minimal reproduction

```ruby
adoc = <<~ADOC
  Some text.

  ```
  code line 1
  code line 2
  code line 3
  ```

  More text.
ADOC

core = Coradoc.parse(adoc, format: :asciidoc)
puts Coradoc.serialize(core, to: :markdown)
```

**Expected:** Either:
- Parse as a code block (preserving line breaks), or
- Treat as literal text with line breaks preserved

**Actual:** All lines are collapsed into a single line:

```
``` code line 1 code line 2 code line 3 ```
```

### Note

Standard AsciiDoc uses `----` (listing block delimiter) for code blocks, not <code>&#96;&#96;&#96;</code>. However, some source files in this corpus use Markdown-style <code>&#96;&#96;&#96;</code> fences. The parser should either handle these gracefully or at minimum preserve line breaks in the output.

### Files affected (5 files, full absolute paths)

```
/Users/mulgogi/src/mn/metanorma.org/_pages/install/cicd-github.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2022-07-27-reviewer-annotations-in-pdf.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2024-11-08-line-numbers.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2024-12-25-metanorma-cli-1.11.3-release.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2026-05-13-channel-based-publication.adoc
```

### No workaround

These files produce garbled output with all code on one line.

---

## Bug 3: Context-dependent table parsing

### Summary

Tables parse correctly when fed to coradoc **in isolation**, but fail when they appear **within a full document** that contains other block types (`====` example blocks, `----` listing blocks, `--` open blocks, etc.) before the table.

### Minimal reproduction (full document)

```ruby
# This WORKS — table parsed correctly:
table_only = <<~ADOC
  [cols="1,1"]
  |===
  | A | B
  | 1 | 2
  |===
ADOC

# This FAILS — same table, but preceded by an example block:
full_doc = <<~ADOC
  ====
  Some example content.
  ====

  [cols="1,1"]
  |===
  | A | B
  | 1 | 2
  |===
ADOC

Coradoc.serialize(Coradoc.parse(full_doc, format: :asciidoc), to: :markdown)
# => table is NOT converted to Markdown table; |=== leaks into output
```

### Confirmed on real files

**`/Users/mulgogi/src/mn/metanorma.org/author/plateau/ref/document-attributes.adoc`**

- Has a `[cols="1,3",options="header"] |=== ... |===` table at source lines 85–167.
- Parsing the table **in isolation**: correct Markdown table output.
- Parsing the **full document**: table is not converted, `|===` delimiters leak into output, no Markdown table generated.

**`/Users/mulgogi/src/mn/metanorma.org/author/iso/ref/sts-mapping.adoc`**

- 3,700+ line reference document with many nested tables.
- Parsing the full document: 5,728 `|===` occurrences in output (most are content, but several are unparsed table delimiters).

### Files where the workaround also fails (3 files, full absolute paths)

These files still have `|===` table delimiter leaks in the final output even after the table-extraction workaround:

```
/Users/mulgogi/src/mn/metanorma.org/author/plateau/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/iso/ref/sts-mapping.adoc
/Users/mulgogi/src/mn/metanorma.org/_posts/2022-07-11-metanorma-collection-si-brochure.adoc
```

### All files with tables (workaround covers these, but root cause is coradoc)

Every `document-attributes.adoc` across all flavors uses the same table pattern:

```
/Users/mulgogi/src/mn/metanorma.org/author/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/bipm/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/bsi/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/cec/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/csa/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/iec/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/ieee/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/ietf/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/gb/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/iho/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/iso/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/itu/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/jis/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/nist/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/ogc/ref/document-attributes.adoc
/Users/mulgogi/src/mn/metanorma.org/author/plateau/ref/document-attributes.adoc
```

Plus all other files in `author/`, `develop/`, `learn/`, `_posts/` that contain `|===` table blocks.

### Current workaround

The conversion pipeline pre-processes each `.adoc` file:
1. Mask all `[source,...]\n----...----` code blocks
2. Mask all `//` comment lines
3. Extract every `|===...|===` table block as a standalone string
4. Parse the document (without tables) with coradoc
5. Parse each extracted table **in isolation** with coradoc (this works)
6. Splice the converted tables back into the Markdown output

This workaround adds significant complexity and has its own edge cases (code block masking can swallow tables that are adjacent to `----` blocks).

---

## How to reproduce

All reproductions use the coradoc monorepo directly:

```bash
cd ~/src/mn/coradoc
bundle exec ruby -e '
  require "coradoc"
  require "coradoc/asciidoc"
  require "coradoc/markdown"

  # Paste any minimal reproduction from above
  adoc = "term one::\n  Definition for term one.\n\nterm two::\n  Definition for term two.\n"
  core = Coradoc.parse(adoc, format: :asciidoc)
  puts Coradoc.serialize(core, to: :markdown)
'
```

To test against any real file listed above:

```bash
cd ~/src/mn/coradoc
bundle exec ruby -e '
  require "coradoc"
  require "coradoc/asciidoc"
  require "coradoc/markdown"

  src = File.read("/Users/mulgogi/src/mn/metanorma.org/author/plateau/ref/document-attributes.adoc")
  core = Coradoc.parse(src, format: :asciidoc)
  puts Coradoc.serialize(core, to: :markdown)
'
```
