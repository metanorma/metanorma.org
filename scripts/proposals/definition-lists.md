# Proposal: AsciiDoc Definition List Support

**Status**: Investigation complete — fix exists on `main`, blocked on branch merge
**Date**: 2026-06-16
**Owner**: metanorma.org conversion pipeline
**Affects**: coradoc parser, metanorma.org `convert-adoc.rb`, all flavor document-attribute reference pages

---

## 1. Problem

### 1.1 Symptom

On every per-flavor document-attributes reference page (e.g.
`/author/iso/ref/document-attributes.html`), nested AsciiDoc definition lists
render as a single run-on paragraph of jumbled text.

**Source** (`author/iso/ref/document-attributes.adoc`):

```asciidoc
`:doctype:`:: Has its possible values defined by ...

`international-standard`::: International Standard (IS)
`technical-specification`::: Technical Specification (TS)
`technical-report`::: Technical Report (TR)
`guide`::: Guide (Guide)
```

**Current rendered output** (one paragraph, items collapsed):

```
`international-standard` ::: International Standard (IS)
`technical-specification` ::: Technical Specification (TS) `technical-report`
::: Technical Report (TR) `guide` ::: Guide (Guide)
```

### 1.2 Scope of Impact

Every flavor's `ref/document-attributes.adoc` uses nested definition lists to
enumerate permitted attribute values. Confirmed affected pages:

- `/author/iso/ref/document-attributes.html`
- `/author/iec/ref/document-attributes.html`
- `/author/ieee/ref/document-attributes.html`
- `/author/itu/ref/document-attributes.html`
- `/author/ietf/ref/document-attributes.html`
- `/author/ietf/ref/document-attributes-v2.html`
- `/author/ogc/ref/document-attributes.html`
- `/author/iho/ref/document-attributes.html`
- `/author/bipm/ref/document-attributes.html`
- `/author/nist/ref/document-attributes.html`
- `/author/bsi/ref/document-attributes.html`
- `/author/jis/ref/document-attributes.html`
- `/author/gb/ref/document-attributes.html`
- `/author/plateau/ref/document-attributes.html`
- `/author/ref/document-attributes.html` (common reference)

Also affects the top-level `/reference/iso-document-attributes.html` and
`/reference/standoc-document-attributes.html`.

### 1.3 User-Facing Consequence

The document-attributes reference is one of the most-used authoring
references. Authors cannot read the permitted values for any attribute — the
content is unreadable.

---

## 2. Root Cause

### 2.1 Diagnosis

The bug is in **coradoc's parser**. coradoc does not recognize AsciiDoc
definition list syntax (`term:: definition`, `term::: nested definition`)
when the term contains colons (e.g., `` `:doctype:` ``).

### 2.2 Evidence

1. **The CoreModel already has DefinitionList types** —
   `coradoc/lib/coradoc/core_model/definition_list.rb` and
   `coradoc/lib/coradoc/core_model/definition_item.rb` exist.

2. **The fix already exists on `main`** — commit `84d4daa` "feat: multi-level
   AsciiDoc definition list support (::, :::, ::::)" by Ronald Tse implements
   proper definition list parsing across the full stack.

3. **The fix cannot be used yet** — the metanorma.org conversion pipeline
   depends on the `feat/yaml-frontmatter` branch, which has a different
   (newer) API than `main`. Cherry-picking the fix onto
   `feat/yaml-frontmatter` produces 229 transformer errors
   (`NoMethodError: undefined method 'content'`). Running the pipeline on
   `main` produces 411 errors (`ArgumentError: Unknown element type for
   serialization`).

4. **Parser output on `feat/yaml-frontmatter`**: When the term contains
   colons (e.g., `` `:doctype:` ``), the parser does not recognize the
   definition list and produces a `ParagraphBlock` with the colons as
   inline text. Nested `:::` items collapse onto a single line.

### 2.3 The Fix on `main` (commit 84d4daa)

The fix touches 12 files across the monorepo:

**Parser (coradoc-adoc)**:
- `parser/list.rb` — `dlist_delimiter` matches longest colon sequence first
  (`:::::` > `::::` > `:::` > `::`) with boundary guards; `dlist_term` uses
  delimiter-aware matching so terms can contain colons
- `model/list/definition_item.rb` — updated for nesting support

**CoreModel (coradoc)**:
- `core_model/definition_item.rb` — gains `nested: DefinitionList` attribute,
  mirroring the `ListItem.nested` pattern

**Transform (coradoc-adoc)**:
- `transform/element_transformers/list_transformer.rb` — bidirectional
  conversion handles nested DefinitionList ↔ DefinitionItem.nested
- `transform/from_core_model.rb` — depth-appropriate delimiters on round-trip
- `transformer/list_rules.rb` — grammar rule updates

**Serializer (coradoc-adoc)**:
- `serializer/serializers/list/definition_item.rb` — recurses into nested
  items, emitting increased delimiter per child level

**HTML (coradoc-html)**:
- `drop/definition_item_drop.rb` — exposes `nested` as `DefinitionListDrop`
- `templates/core_model/definition_list.liquid` — renders nested `<dl>`
  inside parent `<dd>`

### 2.4 Pipeline Stages Ruled Out

| Stage | Status | Reason |
|-------|--------|--------|
| coradoc parsing | **At fault** (on `feat/yaml-frontmatter`) | Does not handle colon-containing terms or nested `:::` |
| coradoc mirror (ProseMirror) | Not involved | This pipeline uses parse → serialize (no mirror step) |
| coradoc markdown serialization | Innocent | Faithfully renders the CoreModel it receives |

### 2.5 Blocker: Branch API Divergence

The `feat/yaml-frontmatter` branch and `main` have diverged:

- `feat/yaml-frontmatter` has: YAML frontmatter support, conversion API
  (`Coradoc.serialize(core, to: :markdown)` accepts CoreModel directly)
- `main` has: definition list fix, but different serialization API
  (`Coradoc.serialize` expects Markdown model, not CoreModel)

**The coradoc team must merge `main` into `feat/yaml-frontmatter`** (or
rebase) for the definition list fix to become usable in the metanorma.org
pipeline.

---

## 3. AsciiDoc Definition List Specification

Per the AsciiDoc language specification, a definition list is a sequence of
list items where each item consists of a term and a description, separated by
one or more colons (`::`) or double-tilde (`::`). The number of separators
indicates nesting depth:

| Syntax | Meaning | Nesting depth |
|--------|---------|---------------|
| `term:: description` | First-level definition | 1 |
| `term::: description` | Nested under parent | 2 |
| `term:::: description` | Deeper nested | 3 |
| `term::::: description` | Deeper still | 4 |

Rules relevant to this proposal:

1. A definition list item is a single line matching `term<separator> description`.
2. The separator is `::` followed by one or more additional `:` for each
   nesting level.
3. Consecutive items at the same depth form a sibling list.
4. An item with more colons than the previous nests inside the previous item's
   description.
5. An item with fewer colons closes the current nested list and returns to
   the parent level.
6. A blank line terminates the entire definition list.
7. A line continuation (`+` at end of line) joins the next line to the current
   description.
8. A literal `+` on its own line creates a paragraph break within a
   description.
9. Definition lists can contain other block elements (examples, notes,
   admonitions) inside descriptions, delimited by block delimiters.

---

## 4. Functional Requirements

### FR-1: Recognize AsciiDoc Definition List Structure

The system must identify AsciiDoc definition list items, their term, their
description, and their nesting depth based on the colon-separator count.

### FR-2: Preserve Structural Hierarchy

Nesting depth in the source must be preserved in the output. Items at depth
2 must visually and semantically nest inside their parent item's description.

### FR-3: Render as Native HTML Definition Lists

Output must produce HTML `<dl>`, `<dt>`, `<dd>` elements — not paragraphs,
blockquotes, or other approximations. VitePress renders these natively.

### FR-4: Preserve Inline Formatting

Inline AsciiDoc formatting within terms and descriptions (monospace, bold,
italic, links, code spans) must continue to render correctly. The conversion
must not strip or break inline markup.

### FR-5: Handle Continuation Lines

Lines joined with `+` must remain attached to their parent description.

### FR-6: Respect Block Boundaries

Definition list processing must not affect content inside fenced code blocks
(`----`), example blocks (`====`), literal blocks (`....`), open blocks
(`--`), sidebars, or admonitions.

### FR-7: Terminate on Blank Lines

A blank line ends the current definition list. Subsequent definition-list
lines start a new list.

### FR-8: No Information Loss

Every term, every description, every nested item must appear in the output.
No content may be silently dropped.

---

## 5. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | All `:::` items on `/author/iso/ref/document-attributes.html` render as separate list entries, not one paragraph | Visual: each item on its own line, indented under parent |
| AC-2 | Nesting is visually clear — `:::` items appear nested under their `::` parent | Visual: child items indented relative to parent |
| AC-3 | Terms render with original formatting (e.g., `` `international-standard` `` renders as monospace) | Visual: monospace styling preserved |
| AC-4 | Code blocks (`----`), example blocks (`====`), and literal blocks are untouched | Diff: byte-identical output for those blocks |
| AC-5 | Pages without definition lists render unchanged | Diff: output unchanged for pages that don't use `::`/`:::` |
| AC-6 | All per-flavor document-attributes pages render correctly | Visual spot-check of ISO, IEC, IETF, OGC, ITU |
| AC-7 | Continuation lines (`+`) stay attached to their parent description | Visual: continuation text appears as part of the same `<dd>` |
| AC-8 | Blank-line-separated definition lists produce separate `<dl>` blocks | DOM inspection: multiple `<dl>` elements |

---

## 6. Constraints

1. **No regex-based line scanning.** The existing `convert_definition_lists`
   regex approach is fragile and explicitly rejected. The fix must use a
   proper parser — either coradoc's grammar (preferred) or a state-machine
   parser that understands AsciiDoc block grammar.

2. **Toolchain rule (AGENTS.md)**: The only approved tool for AsciiDoc
   processing is coradoc. The fix belongs in coradoc's parser if feasible;
   a pre-processor in `convert-adoc.rb` is acceptable only as an interim
   workaround while coradoc is fixed.

3. **No type-unsafe shortcuts.** No `as any`, no error suppression, no
   stringly-typed hacks.

4. **Reversibility.** If the fix is in a pre-processor, it must be possible
   to disable it once coradoc natively supports definition lists.

5. **Performance.** The fix must not significantly slow down conversion.
   Current cache-cold conversion: ~5 minutes for 452 files. The fix should
   add negligible time per file.

---

## 7. Options

### Option A: Fix coradoc's Parser (Preferred)

**What**: Add native AsciiDoc definition list support to coradoc.

- Add a `DefinitionListElement` (or similar) to coradoc's CoreModel,
  representing a list of items where each item has a term, a description,
  and an optional nested list.
- Extend the AsciiDoc parser grammar to recognize the `::`/`:::` separator
  syntax and produce `DefinitionListElement` nodes.
- Extend the markdown serializer to emit HTML `<dl>`/`<dt>`/`<dd>` for
  `DefinitionListElement` nodes (since Markdown has no native definition list
  syntax).

**Pros**:
- Correct location for the fix per AGENTS.md
- Benefits all coradoc users, not just metanorma.org
- Inline formatting handled by coradoc's existing inline parser (no
  duplication)
- Future AsciiDoc features that interact with definition lists work
  automatically

**Cons**:
- Larger effort: requires understanding coradoc's parser grammar, CoreModel,
  transformer, and serializer
- Needs coradoc maintainer review
- Longer timeline before metanorma.org pages are fixed

### Option B: State-Machine Pre-Processor in `convert-adoc.rb` (Interim)

**What**: Add a dedicated parser module to `convert-adoc.rb` that walks lines
with block-context state (tracking fences, example delimiters, literal
blocks) and emits HTML `<dl>`/`<dt>`/`<dd>` directly into the output stream,
before coradoc parses.

- Must be a real state machine, not regex substitution
- Must track: in-code-block, in-example-block, in-literal-block,
  in-sidebar, in-admonition, current nesting stack
- Must delegate inline formatting (backticks, bold, links) to coradoc by
  emitting HTML that coradoc passes through

**Pros**:
- Faster to implement
- Fixes metanorma.org immediately
- Can be removed once Option A lands

**Cons**:
- Duplicates parsing logic that belongs in coradoc
- Must be kept in sync with coradoc's block-detection rules
- Adds to the growing list of pre-processors in `convert-adoc.rb`
- Violates the spirit of AGENTS.md (workaround, not proper fix)

### Option C: Post-Processor on Serialized Markdown

**What**: After coradoc serializes markdown, walk the output and reconstruct
collapsed definition-list paragraphs into `<dl>` blocks.

**Rejected**: The collapsed output loses structural information (nesting
depth is ambiguous once items are on one line). Reconstruction would be
guessing. Fragile and wrong.

---

## 8. Recommendation

**The fix already exists (commit `84d4daa` on `main`). The blocker is branch
divergence, not missing code.**

### Required Action (coradoc team)

Merge `main` into `feat/yaml-frontmatter` (or rebase `feat/yaml-frontmatter`
onto `main`). The branches have diverged in their serialization API:

- `feat/yaml-frontmatter`: `Coradoc.serialize(core, to: :markdown)` accepts
  a `CoreModel::DocumentElement` directly
- `main`: `Coradoc.serialize` expects a Markdown model type, not CoreModel

The merge must reconcile these APIs. Once merged, the metanorma.org pipeline
will get definition list support with no further changes.

### If a Stopgap Is Needed Before the Merge

A minimal pre-processor in `convert-adoc.rb` that converts definition list
syntax to HTML `<dl>` blocks before coradoc parses. This was previously
rejected (Section 6, constraint 1: no regex), but a state-machine parser
that tracks block context (code blocks, examples, etc.) and emits `<dl>`
tags is acceptable as an interim measure. Must be removed once the merge
lands.

### No Action Needed on metanorma.org Side

Once coradoc is updated, re-run:
```bash
cd ~/src/mn/coradoc && bundle exec ruby ~/src/mn/metanorma.org/scripts/convert-adoc.rb --clean
```
The definition list rendering will work automatically.

---

## 9. Out of Scope (Future Phases)

- Multi-paragraph definitions (definitions containing `[example]`, `NOTE:`,
  admonitions, or other block elements inside `<dd>`)
- Definition lists inside table cells (tables are already pre-extracted
  before parsing)
- The `::` double-tilde separator variant (rare; no occurrences in current
  metanorma.org content)

---

## 10. Open Questions

1. **Merge timeline**: When will the coradoc team merge `main` into
   `feat/yaml-frontmatter`? This is the sole blocker. Until then, definition
   lists on metanorma.org will not render correctly.

2. **VitePress rendering of `term\n: definition` syntax**: The coradoc
   markdown serializer on `feat/yaml-frontmatter` emits PHP Markdown Extra
   definition list syntax (`term\n: definition`). VitePress (via markdown-it)
   does not render this natively. Once the fix lands and nested lists are
   preserved, we may still need a markdown-it plugin or custom serializer to
   render definition lists as `<dl>` HTML. This needs verification after the
   merge.

3. **Phase 2 priority**: Multi-paragraph definitions (definitions containing
   `[example]`, `NOTE:`, or other block elements) are not covered by the
   fix. Is this needed for current content?

---

## 11. Investigation Results

The investigation is complete. Key findings:

- **coradoc is a monorepo** with separate gems: `coradoc` (CoreModel),
  `coradoc-adoc` (AsciiDoc parser), `coradoc-markdown` (Markdown),
  `coradoc-html`, `coradoc-mirror`, `coradoc-docx`

- **The CoreModel already has DefinitionList/DefinitionItem** types
  (`coradoc/lib/coradoc/core_model/definition_list.rb`,
  `coradoc/lib/coradoc/core_model/definition_item.rb`)

- **coradoc-markdown already has definition list support** (parser,
  serializer, model, transform) — the markdown side is ready

- **The fix exists on `main`** (commit `84d4daa`) covering parser,
  CoreModel, transform, serializer, and HTML — 12 files total

- **The fix cannot be cherry-picked** onto `feat/yaml-frontmatter` due to
  API divergence (229 errors from transformer incompatibilities)

- **Running the pipeline on `main`** also fails (411 errors — different
  serialization API)

- **The sole blocker is branch divergence** — the coradoc team must merge
  `main` into `feat/yaml-frontmatter`

---

## 12. References

- AsciiDoc User Manual: Definition List
  (https://docs.asciidoctor.org/asciidoc/latest/lists/definition/)
- coradoc repository: `~/src/mn/coradoc/`
- metanorma.org conversion pipeline:
  [`scripts/convert-adoc.rb`](file:///Users/mulgogi/src/mn/metanorma.org/scripts/convert-adoc.rb)
- Affected source file (example):
  [`author/iso/ref/document-attributes.adoc`](file:///Users/mulgogi/src/mn/metanorma.org/author/iso/ref/document-attributes.adoc)
- Existing (broken) pre-processor:
  `convert_definition_lists` function in `convert-adoc.rb`
