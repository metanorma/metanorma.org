# YAML data schemas

Every kind of YAML data in this repository has a formal schema here —
**written in YAML** (JSON Schema draft 2020-12 in YAML form) and serving
as the **single source of truth**. Runtime models are derived from these
schemas, never maintained in parallel: the zod modules are generated code.

| Data kind | Files | Schema (SSOT) | Derived runtime model | Consumers |
|---|---|---|---|---|
| Attribute manifests | `attributes/*.yaml` | `attribute-manifest.schema.yaml` | `src/lib/attr-schema.generated.ts` (**generated**) | `attributes` collection, `src/lib/attributes.ts`, `AttributeRef` renderer |
| Page frontmatter | YAML blocks in `.adoc` | `frontmatter.schema.yaml` | `src/lib/frontmatter-schema.generated.ts` (**generated**) | converter, mirror loader, SEO/Article metadata |
| Section registry | `src/config/sections.yml` | `sections.schema.yaml` | enforced by `Convert::Section` (Ruby) | converter, `src/lib/nav-tree.ts`, `scripts/verify-content.mjs` |
| Nav trees | `**/_nav.yml` | `nav.schema.yaml` | enforced by `src/lib/nav-tree.ts` | sidebars, breadcrumbs, `scripts/check-nav.mjs` |
| Root labels | `src/config/root-labels.yml` | `root-labels.schema.yaml` | — | breadcrumbs (`src/lib/breadcrumbs.ts`) |

## How it works

```
schemas/*.schema.yaml  (hand-authored, the contract)
        │
        ├─ scripts/build-schemas.mjs ──► src/lib/*.generated.ts   (zod, committed)
        │        --check = drift gate (fails CI when out of sync)
        │
        └─ scripts/check-schemas.mjs (ajv) ──► validates every data file
                 ▲ same core: scripts/lib/schema-check.mjs
                 └─ vitest suite + CI gate
```

- **Editor**: data files carry a `# yaml-language-server: $schema=…`
  modeline, and `.vscode/settings.json` maps schemas by glob — squiggles
  and autocomplete as you type.
- **CLI**: `npm run check:schemas` validates all data files against the
  YAML schemas (ajv).
- **Tests**: `src/__tests__/yaml-schemas.test.ts` runs the same checks
  plus the generated-code drift test.
- **CI**: `check:schemas` and `node scripts/build-schemas.mjs --check`
  run in `.github/workflows/build.yml`.
- The schemas themselves are meta-validated on every generator run
  (malformed schemas fail `build:schemas`).

### Changing a model

1. Edit the YAML schema (e.g. add an attribute field to
   `attribute-manifest.schema.yaml`).
2. `npm run build:schemas` — regenerates the zod modules (commit both).
3. `npm run check:schemas && npm test`.

### Adding a new YAML data kind

1. Write `schemas/<kind>.schema.yaml`.
2. Add an entry to `CHECKS` in `scripts/lib/schema-check.mjs` — the CLI,
   the vitest suite, and CI pick it up automatically. If it has a
   TypeScript consumer, add a `TARGETS` entry in
   `scripts/build-schemas.mjs` to get a generated zod module.
3. Add the editor association in `.vscode/settings.json` (plus a modeline
   in the data files when there are few of them).
4. Document it in the table above.

The generator (`scripts/lib/yaml-zod-codegen.mjs`) supports the JSON
Schema subset these schemas use: objects (strict/passthrough/records),
strings (enum/pattern/minLength), numbers, booleans, null, arrays,
`anyOf`, `const`, and local `#/$defs/` refs. Conditionals (`if`/`then`,
as in `sections.schema.yaml`'s *mapping=fixed ⇒ files required*) are
validated by ajv but are not expressible in zod — the generator rejects
them for zod targets; the runtime enforces them instead.

## Field references

### `src/config/sections.yml` (section registry)

One entry per content section. Adding a section is one YAML entry — no
other file changes.

```yaml
sections:
  - id: author            # stable identifier
    source_dir: author    # repo-root-relative source directory
    output_prefix: author # mirror-json/URL prefix for output
    nav_root: true        # sidebar root?
    mapping: tree         # tree | prefix | date_prefix | fixed | ref_strip
    source_extensions: [adoc]   # optional (default: [adoc])
    files:                # required for mapping: fixed
      install.adoc: install/index
```

Mapping kinds:

- `tree` — recursive; output is `<output_prefix>/<kebab subpath>/<kebab basename>`; only `.adoc` is stripped.
- `prefix` — like `tree`, but `.html` is stripped too (legacy `_pages` subdirs).
- `date_prefix` — blog posts: `YYYY-MM-DD-slug.adoc` → `<output_prefix>/YYYY-MM-DD-slug`.
- `fixed` — explicit per-file map in `files:`; unlisted files are unmapped.
- `ref_strip` — basename minus any `Ref-` prefix, downcased + kebabed.

### `**/_nav.yml` (nav trees)

Drives the left sidebar of each section. Resolved by
`src/lib/nav-tree.ts` (longest-prefix match; `dir:` inlines a
subdirectory's `_nav.yml`). `npm run check:nav` additionally fails on
pages not declared in any nav.

```yaml
title: ISO                     # sidebar heading
items:
  - title: Quick start         # a page link
    file: sample               # source-relative path, no extension
    description: The Rice model sample
  - title: Authoring           # a group (children inlined from topics/_nav.yml)
    file: topics               # optional group hub page
    dir: topics
    description: Using Metanorma-ISO
```

Rules: `file` paths resolve through the owning section's `output_prefix`
(e.g. `_pages/install/macos` → `/install/macos/`); keep titles human (no
auto-generated casing); a group with a hub page has both `file:` and
`dir:`; do not duplicate the same page as both a file entry and a dir
child.

### `src/config/root-labels.yml` (root labels)

Flat map of root URL segment → breadcrumb display label, used when no
`_nav.yml` resolves the segment:

```yaml
flavors: Flavors
install: Install
```

### Page frontmatter

YAML block at the top of each `.adoc` source (`---` fences). Common keys
(see `frontmatter.schema.yaml` for the contract): `title`, `subtitle`,
`description`, `excerpt`, `date` (blog), `author` (`name`, `use_picture`,
`social_links`), `card_image` (per-page social image), `redirect_from`
(string or list — legacy URLs that redirect here). Unknown keys are
allowed (passthrough) but only the documented ones are consumed.
