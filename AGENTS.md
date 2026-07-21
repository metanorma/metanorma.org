# AGENTS.md — metanorma.org

**Repo:** https://github.com/metanorma/metanorma.org

## OVERVIEW

Astro 7 static site for Metanorma — the standards authoring toolchain. Documentation, blog, flavor index, software catalog, and references. Content is authored in AsciiDoc at repo root, converted to mirror-json envelopes by a Ruby converter (coradoc), loaded through a custom Astro Content Layer loader, and rendered to static HTML. Deployed to GitHub Pages via CI.

## PIPELINE

```
.adoc sources (author/, flavors/, learn/, develop/, software/, specs/,
_posts/, _pages/, reference_docs/)
   ↓ scripts/convert-adoc.rb — thin CLI shim over scripts/convert.rb +
     scripts/convert/*.rb (Section, SectionRegistry, SourceFile, NavTitles,
     Conversion, EnvelopeStore, Converter; all autoloaded)
mirror-json/*.json envelopes
     (dependency-aware mtime cache, orphan pruning, manifest.json
      with fingerprints)
   ↓ src/content/loaders/mirror-loader.ts — Astro Content Layer loader
     (store.clear() + parallel batches + stripFirstHeadingIf option)
   ↓ src/lib/render-pipeline.ts — RenderPipeline explicitly composed of
     base + component renderers
dist/ (astro build + pagefind)
```

**Section registry (SSOT)**: `src/config/sections.yml` — one entry per content section (id, source_dir, output_prefix, nav_root, mapping kind: tree/prefix/date_prefix/fixed/ref_strip, files map for fixed). Consumed by the Ruby converter, `src/lib/nav-tree.ts` (nav roots), and `scripts/verify-content.mjs`. Adding a section = one entry. Current sections: author, flavors, develop, learn, software, specs (tree+nav), blog (`_posts`, date_prefix), install (`_pages/install`, prefix, nav), pages (`_pages` fixed map), reference (`reference_docs`, ref_strip). The library/samples sections were REMOVED (consolidated into software/flavors with redirects); sources remain on disk.

## STRUCTURE

```
metanorma.org/
├── author/            # Author docs hub: basics/, topics/, ref/, editors-guide/
├── flavors/           # Per-flavor docs: <flavor>.adoc + <flavor>/ (authoring, ref, sample)
├── develop/           # Developer docs (topics/, ref/)
├── learn/             # Tutorials (lessons/, exercises-code/)
├── software/          # Software catalog entries (.adoc + synced docs/ subtrees)
├── specs/             # Data model specs (.adoc + <model>/images/)
├── _posts/            # Blog posts (date-prefixed .adoc)
├── _pages/            # Static pages incl. install/
├── reference_docs/    # Legacy attribute refs (SUPERSEDED) + dormant YAML_models/
├── attributes/        # LIVE attribute manifests: {standoc,iso,ietf,ietf-v2}.yaml
├── mirror-json/       # Converter output (derived; input to the Astro loader)
├── src/               # Astro app: pages/, components/, layouts/, lib/, config/, data/
│   ├── config/        #   sections.yml (SSOT), site.ts (header nav + footer)
│   ├── lib/           #   Framework-agnostic: render-pipeline, nav-tree, attributes…
│   └── content/       #   loaders/mirror-loader.ts
├── scripts/           # convert-adoc.rb + convert/ (Ruby), check-nav.mjs,
│                      # verify-content.mjs, extract-attributes.rb + extract_attributes/
├── spec/              # RSpec: converter (spec/convert/) + extraction (spec/scripts/)
├── public/            # Static assets served at /
├── _upstream/         # rake sync cache of upstream flavor repos (gitignored)
└── dist/              # Build output (gitignored)
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add/edit a content page | The section's source dir (`author/`, `flavors/`, …) as `.adoc` |
| Add/edit blog post | `_posts/YYYY-MM-DD-title.adoc` |
| Add a whole content section | One entry in `src/config/sections.yml` |
| Edit header nav / footer | `src/config/site.ts` (`mega: true` marks the Flavors mega-menu) |
| Edit a section sidebar | That directory's `_nav.yml` (resolved by `src/lib/nav-tree.ts`) |
| Add a redirect | `redirect_from:` in the target page's frontmatter (auto-collected) |
| One-off legacy redirect | `STATIC_LEGACY_REDIRECTS` in `astro.config.mjs` |
| Add/edit document attributes | `attributes/<flavor>.yaml` (via `scripts/extract-attributes.rb`) |
| Serve a new attribute ref page | One entry in `src/lib/attr-registry.ts` |
| Register a software project | `software/<name>.adoc` (frontmatter drives `rake sync`) |
| Add a data model spec | `specs/metanorma-model-<flavor>.adoc` + `<model>/images/` |
| Add a flavor | See FLAVOR STRUCTURE below |
| Rendering / pipeline code | `src/lib/render-pipeline.ts`, `src/lib/mirror-renderer.ts` |
| Content quality gate | `scripts/verify-content.mjs` |
| Nav orphan gate | `scripts/check-nav.mjs` |

## CONTENT CONVENTIONS

- **Primary format**: AsciiDoc (`.adoc`) converted by coradoc → mirror-json. Never edit `mirror-json/` by hand — it is derived output.
- **Frontmatter**: YAML; `title:` required for pages (rendered as the only `<h1>`).
- **Redirects**: add `redirect_from:` to the destination page's frontmatter — collected from envelopes at config load (`src/config/redirects-from-content.mjs`, collision-checked). NEVER delete or rename a page without one.
- **Nav files**: each nav-root directory has a `_nav.yml`; every converted page must be declared in one — `npm run check:nav` fails on orphans. `dir:` entries inline a subdirectory's tree; `output_prefix` mapping handles sections like install.
- **Blog images**: `assets/blog/<YYYY-MM-DD>/` matching post date.
- **Cross-references**: root-relative URLs (`/author/…`); avoid absolute URLs to own site.
- **Branch naming**: `doc<YYYYMMDD>` for doc branches, `rt-<description>` for feature/fix branches.

## FLAVOR STRUCTURE

A live Metanorma flavor has:

1. `flavors/<flavor>.adoc` + `flavors/<flavor>/` — flavor docs (authoring guide, ref, sample)
2. An entry in the flavor catalog `src/data/flavors.ts` — drives cards, mega-menu, and the generated `/author/{id}/…` → `/flavors/{id}/…` redirects
3. `software/metanorma-<flavor>.adoc` — software catalog entry (only gems with upstream docs — currently just metanorma-cli — carry a `docs.git_repo_subtree` frontmatter block that drives `rake sync`; flavor docs live in-tree under `flavors/`)
4. If it has a document-attribute reference: `attributes/<flavor>.yaml` (generated by `scripts/extract-attributes.rb`) + one entry in `src/lib/attr-registry.ts`

Flavor abbreviation ≠ org abbreviation (e.g., M3AAWG flavor = `m3aawg`). The `--type` CLI flag matches the lowercase flavor abbreviation.

## ATTRIBUTES SYSTEM

`attributes/{standoc,iso,ietf,ietf-v2}.yaml` are machine-readable per-flavor attribute manifests (flavor/label/inherits_from/attributes; per-attribute category/type/values/default/required/repeatable/added_in/example/description/applies_to). Extracted from the flavor gems by `scripts/extract-attributes.rb` (library: `scripts/extract_attributes.rb` + `scripts/extract_attributes/`; specs: `spec/scripts/`). Consumed by the `attributes` content collection (`src/content.config.ts`, schema `src/lib/attr-schema.ts`), merged by `src/lib/attributes.ts` (standoc inheritance, override-wins, applies_to subset), rendered by `src/components/AttributeRef.astro` + `AttrEntry.astro` at `src/pages/author/ref/document-attributes.astro` and `src/pages/flavors/[id]/ref/[page].astro` (route registry: `src/lib/attr-registry.ts`). The four old hand-written `.adoc` pages are SUPERSEDED (still on disk). Prose companions remain live mirror pages: `flavors/iso/ref/identifier-patterns.adoc`, `flavors/ietf/ref/global-options.adoc`.

**Authoring guide: `attributes/README.md`** — field reference, type vocabulary, applicability scopes, editing/adding/regenerating manifests, validator-parity rule. Read it before touching any manifest.

## YAML DATA SCHEMAS

Every kind of YAML data has a formal schema in `schemas/` — **written in YAML and serving as the single source of truth**. Runtime models are derived, never maintained in parallel: the zod modules (`src/lib/*.generated.ts`) are **generated** from the YAML schemas by `npm run build:schemas` — never hand-edit generated code. See `schemas/README.md` for the full map and field references.

- `attributes/*.yaml` → `schemas/attribute-manifest.schema.yaml` → generates `src/lib/attr-schema.generated.ts`
- Page frontmatter → `schemas/frontmatter.schema.yaml` → generates `src/lib/frontmatter-schema.generated.ts`
- `src/config/sections.yml` → `schemas/sections.schema.yaml` (validation-only; enforced by `Convert::Section`)
- `**/_nav.yml` → `schemas/nav.schema.yaml` (validation-only)
- `src/config/root-labels.yml` → `schemas/root-labels.schema.yaml` (validation-only)

`npm run check:schemas` validates all data files against the YAML schemas (ajv); the vitest suite and CI run the same checks plus the generated-code drift gate (`node scripts/build-schemas.mjs --check`). Editor squiggles come from `# yaml-language-server: $schema=` modelines + the `.vscode/settings.json` associations.

## ABSOLUTE RULE: NEVER USE ASCIIDOCTOR OR ANTORA

- **NEVER use `asciidoctor`** (Ruby gem, JS npm package `@asciidoctor/core`, or any other binding). Not for rendering, not for conversion, not as fallback.
- **NEVER use `antora`** or any Antora components (`@antora/*`).
- The ONLY approved tool for AsciiDoc processing is **coradoc** (installed via the `Gemfile` — `gem "coradoc-adoc"`). If coradoc has a bug, fix coradoc upstream and bump the gem version. Report bugs in `scripts/coradoc-bug-report.md`.
- The pipeline is: `.adoc` → coradoc parse → CoreModel → coradoc-mirror → ProseMirror JSON → Astro renderer.
- This rule applies to ALL projects, ALL sessions, forever.

## NEVER DELETE SOURCE FILES

`.adoc` files are source; `mirror-json/` and `dist/` are derived output. Superseded content is NOT deleted — it is added to the `SUPERSEDED` table in `scripts/convert/path_mapping.rb` (with the replacement noted), which filters it out at collection time while keeping it on disk. `scripts/check-nav.mjs` knows this table. `Gemfile.lock` IS committed — it pins the coradoc toolchain for reproducible CI builds.

## ANTI-PATTERNS

- **Never delete or rename pages** without adding `redirect_from:` — dead links
- **Never commit directly to `main`** — use PRs via feature branches
- **Never push tags** — CI handles releases
- **Never edit `mirror-json/`, `dist/`, or `_upstream/`** — derived output
- **Never hand-write sidebar JSON** — sidebars come from `_nav.yml` files
- **`software/*/docs/`, `specs/*/images/` (synced parts), `_upstream/`** are pulled by `rake sync` — do not manually edit synced content; it is overwritten
- Ruby: use `autoload`, never `require_relative` for internal library code

## COMMANDS

```bash
npm run convert       # .adoc → mirror-json (incremental; --clean via npm run clean)
npm run dev           # convert, then astro dev
npm run build         # convert, then astro build + pagefind → dist/
npm run preview       # serve dist/
npm test              # vitest (colocated src/**/__tests__/)
npm run check         # astro check (TypeScript diagnostics)
npm run check:nav     # nav orphan check (_nav.yml coverage)
npm run check:schemas # validate all YAML data files against schemas/
npm run build:schemas # regenerate zod models from schemas/*.schema.yaml (--check = drift gate)
node scripts/verify-content.mjs   # post-build content quality gate
bundle exec rspec     # Ruby specs: converter + attribute extraction
bundle exec rake sync # clone upstream flavor repos → _upstream/, pull
                      # docs → software/<gem>/docs/, images → specs/<model>/images/
```

## CI

`.github/workflows/build.yml` — on PRs and `main`: rspec → vitest → check:nav → check:schemas → schema drift check → astro check → rake sync → build → verify-content; deploys to GitHub Pages on `main` only. Link checking: `.github/workflows/links.yml`.
