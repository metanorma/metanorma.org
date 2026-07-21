# Document attribute manifests

This directory holds the **machine-readable definitions of every Metanorma
document attribute**, one YAML file per flavor. They are the single source
of truth for the generated document-attribute reference pages:

| Manifest | Reference page |
|---|---|
| `standoc.yaml` | https://www.metanorma.org/author/ref/document-attributes/ |
| `iso.yaml` | https://www.metanorma.org/flavors/iso/ref/document-attributes/ |
| `ietf.yaml` | https://www.metanorma.org/flavors/ietf/ref/document-attributes/ |
| `ietf-v2.yaml` | https://www.metanorma.org/flavors/ietf/ref/document-attributes-v2/ |

The pipeline: manifest → `attributes` content collection (zod-validated)
→ merge/inheritance (`src/lib/attributes.ts`) → `AttributeRef` renderer
(chips, anchors, filter) → the pages above.

Schema: `../schemas/attribute-manifest.schema.yaml` — the single source
of truth for the manifest contract (the zod model
`src/lib/attr-schema.generated.ts` is **generated** from it by
`npm run build:schemas`; never hand-edit generated code). Validate any
edit with `npm run check:schemas`.

## File anatomy

```yaml
# yaml-language-server: $schema=../schemas/attribute-manifest.schema.json
flavor: iso                 # machine id ('standoc' for the generic set)
label: ISO                  # display name
inherits_from: standoc      # parent manifest, or null (standoc itself)
gem: metanorma-iso          # optional: the gem that implements these
source: flavors/iso/ref/document-attributes.adoc   # optional provenance
notes: See /flavors/iso/ref/identifier-patterns/ for identifier rules.
description: |              # optional intro rendered at the top of the page
  ...
sections:                   # optional prose blocks per category (standoc)
  - name: Document information
    prose: |
      ...
attributes:                 # the attributes, keyed by name
  docstage:
    ...
```

## Per-attribute fields

The record **key** is the attribute name as typed in the document header,
without colons (`docstage`, `fullname{_i}`, `=-Document-Title`).

| Field | Type | Meaning |
|---|---|---|
| `category` | string (required) | Top-level grouping on the page (`Document information`, …). |
| `subsection` | string | Second-level grouping inside the category. |
| `title` | string | Display title when it differs from the name. Rarely used. |
| `type` | enum | Value kind — see the vocabulary below. |
| `values` | list | Accepted values for `enum` types: `{name, description?, added_in?, notes?}`. |
| `default` | string | Value applied when the attribute is omitted. |
| `required` | boolean | The document cannot be processed without it. |
| `repeatable` | boolean | Indexed attribute (`{_i}`: `:fullname_1:`, `:fullname_2:`, …). |
| `applies_to` | list | Flavor ids this attribute applies to — see "Applicability" below. |
| `added_in` | `{component, version}` | First release that supports the attribute. Rendered as a version chip. |
| `deprecated_in` | `{component, version}` | Release that deprecated it (warning chip). |
| `version_history` | list of version refs | Further releases that changed the attribute. |
| `deprecated` | boolean | Deprecated without a known release. |
| `example` | string | Header snippet, e.g. `":docstage: 60"`. |
| `description` | string | Prose documentation (inline markup supported — see below). |
| `anchor` | string | Deep-link anchor when it differs from the name (legacy pages). |
| `aliases` | list | Other names for the same attribute (alias anchors are emitted). |
| `alias_of` | string | Marks this entry as an alias OF another entry (satellite). |
| `see` | string | Pointer to the entry that actually documents this name. |
| `legacy` | list | Legacy `mn-*` names (alias anchors are emitted). |
| `notes` | string | Extra caveats shown as a meta line. |
| `source_term` | string | The source-page term this entry was normalized from (extraction provenance). |

Only `category` is required. **Never invent values** — `type`, `values`,
`default`, `required`, `added_in` are only written when the information is
known (from the previous documentation or the gem's code).

## The `type` vocabulary

| `type` | Meaning | Extra fields |
|---|---|---|
| `string` | Free text (default when unsure). | — |
| `enum` | One of a fixed set. | `values:` list with per-value `name` + `description` |
| `boolean` | Flag (`true`/`false`). | — |
| `integer` / `number` | Numeric. | — |
| `uri` | A URL/URI. | — |
| `date` | ISO 8601 date. | — |
| `comma-list` | Comma-separated list of values. | — |

## Applicability (`applies_to`)

Every attribute has exactly one of three scopes:

- **All flavors** — entries in `standoc.yaml` with no `applies_to`.
  Inherited onto every flavor page.
- **Single flavor** — entries in a flavor manifest with no `applies_to`.
- **A subset** — `applies_to: [iso, iec]` on any entry, in any manifest.
  Rendered on exactly those flavors' pages.

Merge rule for a flavor page: standoc entries (no `applies_to` or listing
the flavor) **+** the flavor's own entries **+** other manifests' entries
listing the flavor. A same-named flavor entry **fully replaces** the
inherited standoc entry (e.g. `:doctype:` has different enums per flavor).

## Version references → chips

`added_in` / `deprecated_in` name the **component** (gem) because release
tags differ per repository — `metanorma-iso v1.3.25` is not
`metanorma-standoc v1.3.25`. They render as linked chips
(`metanorma-iso ≥ v1.3.25` → the GitHub release). The first `[added in …]`
macro from the old docs becomes `added_in`; later ones go into
`version_history`.

## Description formatting

Descriptions are plain text with a small inline-markup subset (rendered by
`src/lib/attr-description.ts`): `` `code` ``, `*bold*`, `_italic_`,
`link:https://…[text]`, `"`smart`"` quotes, `<<anchor,text>>` xrefs,
bullet lists, `[NOTE]`/`[TIP]` admonitions, `[source]` fences,
`[example]` blocks, and `.Caption` lines. Paragraphs are preserved. Do not
paste HTML.

## Authoring workflow

### Editing an existing manifest

1. Edit the YAML (your editor validates live via the modeline /
   workspace schema association).
2. `npm run check:schemas` — must pass.
3. `npm test` — the merge/schema suites must pass.
4. `npm run build` and eyeball the rendered page.

**Accepted values must match the gem.** When a flavor gem changes what it
accepts (e.g. a new `doctype` value in its validator), update the manifest
in the same change. If the docs and the gem disagree, the gem wins — fix
the manifest, and note discrepancies in the entry's `notes:`.

### Adding a new flavor

1. Bootstrap the manifest from the flavor's existing hand-written page:
   `bundle exec ruby scripts/extract-attributes.rb <flavor>` (the
   extractor lives in `scripts/extract_attributes.rb`; review its output —
   it never invents `type`/`values`/`default`).
2. Correct accepted values against the gem's validation code
   (`lib/metanorma/<flavor>/validate*.rb`).
3. Register the page in `src/lib/attr-registry.ts` (one entry).
4. Move any non-attribute prose into a companion page under
   `flavors/<flavor>/ref/`, and point `notes:` at it.
5. Supersede the old `.adoc` page in `scripts/convert/path_mapping.rb`
   (the file stays on disk), then `npm run clean && npm run convert`.
6. `npm test && npm run check:schemas && npm run build` — all green.

### Regenerating an existing manifest

`bundle exec ruby scripts/extract-attributes.rb` re-extracts from the
(superseded but kept) source pages. Hand corrections made after the first
extraction live in `VALIDATOR_AMENDMENTS` (`scripts/extract_attributes.rb`)
so re-runs stay stable — add new corrections there, not only in the YAML.

## The future home of these manifests

These files are scheduled to move **into the flavor gems themselves**
(`docs/attributes.yaml` in each repo, versioned with the code), synced
here via `rake sync`. Long-term the gems should generate their manifests
from their own validators, making documentation drift impossible. Keep the
schema backward-compatible when you edit it — gem-side producers will
implement against it.
