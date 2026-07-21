# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Site Is

metanorma.org — the public site for the Metanorma standard-document platform. Documentation, blog, flavor index, software catalog, and references.

## Architecture (Astro + Content Collections)

The site is built with [Astro 7](https://astro.build) using vanilla `.astro` components for static output plus small Vue islands for interactivity (dark toggle, mobile menu, search). Content is delivered via a custom Content Layer loader that reads mirror-json envelopes produced by coradoc.

### Source pipeline

```
.adoc sources at repo root (sections registered in src/config/sections.yml)
   ↓ scripts/convert-adoc.rb — CLI shim over scripts/convert.rb + scripts/convert/*.rb
mirror-json/<key>.json envelopes (AST + frontmatter, mtime cache, manifest.json)
   ↓ src/content/loaders/mirror-loader.ts (custom Astro Content Layer loader)
typed `mirror` collection entries with pre-computed headings + KaTeX-rendered math
   ↓ src/components/MirrorContent.astro (via src/lib/render-pipeline.ts)
rendered HTML in <article>
```

### Project layout

```
src/
├── pages/                  # File-based routing
│   ├── index.astro         # Home (catalog-driven)
│   ├── 404.astro
│   ├── about.md            # Hand-authored Markdown (Astro renders natively)
│   ├── get-started.md
│   ├── rss.xml.ts          # @astrojs/rss endpoint
│   ├── blog/
│   │   ├── [...page].astro # Paginated index
│   │   └── [...slug].astro # Individual post (shadows catch-all)
│   ├── flavors/
│   │   ├── index.astro
│   │   ├── [id].astro
│   │   └── [id]/ref/[page].astro  # Attribute reference pages (from attributes/*.yaml)
│   ├── author/ref/document-attributes.astro  # Standoc attribute reference
│   ├── software/index.astro
│   └── [...slug].astro     # Catch-all for mirror-json content
├── layouts/
│   └── BaseLayout.astro    # HTML shell, anti-FOUC theme, View Transitions
├── components/             # .astro (static) + .vue (islands)
│   ├── Article.astro       # Page wrapper (title, subtitle, error, slot)
│   ├── MirrorContent.astro # Renders mirror-json AST → HTML
│   ├── AttributeRef.astro, AttrEntry.astro  # Attribute reference rendering
│   ├── Nav.astro           # Header nav (CSS hover+:focus-within dropdowns, mega-menu)
│   ├── Footer.astro
│   ├── Sidebar.astro       # Left sidebar (native <details> for collapse)
│   ├── TOC.astro           # Right-side TOC (pre-computed headings + scroll-spy)
│   ├── FlavorCard.astro, FlavorGrid.astro, FlavorPage.astro
│   ├── SoftwareGrid.astro
│   └── DarkToggle.vue, MobileMenu.vue, SearchButton.vue  # Vue islands
├── content/
│   └── loaders/
│       └── mirror-loader.ts # Custom loader (single source of truth for mirror-json)
├── content.config.ts       # Collection schemas (mirror, attributes)
├── lib/                    # Framework-agnostic
│   ├── render-pipeline.ts  # Ordered HTML transforms; explicit renderer composition
│   ├── mirror-renderer.ts  # Base AST → HTML node renderers
│   ├── component-renderers.ts # Component-level node renderers
│   ├── nav-tree.ts         # _nav.yml → sidebar trees (longest-prefix resolve)
│   ├── attributes.ts       # Attribute manifest merge (standoc inheritance)
│   ├── attr-schema.ts      # Attribute manifest schema
│   ├── attr-registry.ts    # Route registry for attribute reference pages
│   ├── heading-levels.ts   # Section level N → <h(N+1)> mapping
│   ├── blog-date.ts        # Ruby/Jekyll date → ISO 8601
│   ├── format-date.ts      # Shared date formatter
│   ├── frontmatter.ts      # YAML frontmatter parsing
│   └── render-math.ts      # KaTeX pre-rendering at build time
├── data/                   # Typed catalog
│   ├── flavors.ts, software.ts, posts.ts, home.ts, types.ts, index.ts
└── config/
    ├── sections.yml        # SECTION REGISTRY (SSOT) — see below
    ├── site.ts             # Header nav (mega: true marker) + curated footerColumns
    └── redirects-from-content.mjs # redirect_from collection + mergeRedirects + sitemap filter

attributes/                 # Attribute manifests {standoc,iso,ietf,ietf-v2}.yaml
scripts/
├── convert-adoc.rb         # CLI shim — .adoc → mirror-json
├── convert.rb + convert/   # Converter library (autoloaded classes, see below)
├── extract-attributes.rb   # CLI shim — flavor gems → attributes/*.yaml
├── extract_attributes.rb + extract_attributes/  # Extraction library
├── check-nav.mjs           # Fails on pages missing from every _nav.yml
├── verify-content.mjs      # Post-build content parity/quality check
└── sync (Rakefile)         # rake sync — upstream flavor repos → _upstream/, docs → software/*/docs/

spec/                       # RSpec: convert/ (converter) + scripts/ (extraction)
public/                     # Static assets served at / (auto-included)
mirror-json/                # coradoc output (input to mirror-loader; derived — never edit)
_upstream/                  # rake sync clone cache (gitignored)
dist/                       # Astro build output
```

### Section registry (`src/config/sections.yml`)

The single source of truth for "which directories hold source `.adoc`, where their mirror-json output lives, and which sections get a sidebar". One entry per section: `id`, `source_dir`, `output_prefix`, `nav_root`, `mapping` (tree / prefix / date_prefix / fixed / ref_strip), `files` map for fixed. Consumed by the Ruby converter, `src/lib/nav-tree.ts` (nav roots), and `scripts/verify-content.mjs` (area counts). Adding a section = one entry. The library/samples sections were removed (consolidated into software/flavors with redirects); their sources remain on disk.

### Routing

- File-based: Astro auto-routes `src/pages/**/*.{astro,md}` to URLs.
- Catch-all `[...slug].astro` looks up `getEntry('mirror', slug)` for any mirror-json entry.
- Specific routes (blog, flavors, software, home, about, get-started, 404, attribute pages) shadow the catch-all.
- Redirects: `astro.config.mjs.redirects` merges `STATIC_LEGACY_REDIRECTS` (one-offs) + catalog-generated flavor redirects (from `src/data/flavors.ts` and envelope slugs) + attribute-page redirects (`src/lib/attr-registry.ts`) + per-content `redirect_from` collected from envelopes (`src/config/redirects-from-content.mjs`). Envelopes are read once and shared; `mergeRedirects` throws on collisions. Redirect sources are excluded from the sitemap via `makeSitemapFilter`.
- Sitemap: `@astrojs/sitemap` emits `dist/sitemap-index.xml` → `dist/sitemap-0.xml`. There is intentionally no `/sitemap.xml` static file (a stale hand-maintained one in `public/` was removed).

## Common Commands

```bash
npm run convert       # ruby scripts/convert-adoc.rb (incremental)
npm run clean         # convert-adoc.rb --clean (force full rebuild)
npm run dev           # predev runs convert, then astro dev
npm run build         # prebuild runs convert, then astro build + pagefind
npm run preview       # serve the built dist/
npm run check         # astro check (TypeScript diagnostics for .astro files)
npm test              # vitest run (colocated src/**/__tests__/)
npm run check:nav     # nav orphan check — every page must be in a _nav.yml
npm run check:schemas # validate all YAML data files against schemas/*.schema.json (ajv)
npm run build:schemas # regenerate zod-derived JSON Schemas (--check = drift gate)
node scripts/verify-content.mjs   # post-build content quality gate
bundle exec rspec     # Ruby specs: converter (spec/convert/) + extraction (spec/scripts/)
bundle exec rake sync # pull upstream flavor docs/images (targets from frontmatter)
```

`convert-adoc.rb` runs via `bundle exec` from the project root. The `Gemfile` declares `coradoc`, `coradoc-adoc`, and `coradoc-mirror` gems — Bundler resolves and loads them. No local coradoc checkout required.

## Conversion Pipeline (`scripts/convert-adoc.rb`)

The CLI shim delegates to the converter library (`scripts/convert.rb` + `scripts/convert/*.rb`, all `autoload`ed):

- `Section` / `SectionRegistry` — typed view over `src/config/sections.yml` (source dirs, output prefixes, mapping kinds, per-section nav cache scoping)
- `SourceFile` / `sources.rb` — source collection per section; files in the `SUPERSEDED` table (`scripts/convert/path_mapping.rb`) are filtered out here (still kept on disk)
- `path_mapping.rb` — section-independent URL/path string helpers (the one kebab implementation) + the `SUPERSEDED` table
- `Conversion` — one source file → one envelope: frontmatter parse (`Coradoc::CoreModel::FrontmatterBlock`), `Coradoc.parse` → `resolve_includes` → `rewrite_links`, legacy `redirect_from` injection, empty-body synthesis
- `NavTitles` — per-section `_nav.yml` title cache
- `EnvelopeStore` — writes `mirror-json/<key>.json`, dependency-aware mtime cache, orphan pruning, `mirror-json/manifest.json` with fingerprints
- `Converter` — orchestrates: collect → convert → hub synthesis → model-diagram stubs → asset copy (images/PDFs into `public/`, kebab-mapped)

`--clean` forces a full rebuild. Production URLs are the canonical target — blog emits `/blog/YYYY-MM-DD-slug`, other paths use kebab-case; every source file whose kebab output differs from the production snake_case URL gets `redirect_from:` injected automatically.

## Render Pipeline (`src/lib/render-pipeline.ts` + `src/lib/mirror-renderer.ts`)

Renders mirror-json envelopes (prosemirror-style AST with `type`, `content`, `text`, `marks`, `attrs`) to HTML. `RenderPipeline` is composed EXPLICITLY at construction time (`{ ...baseRenderers, ...componentRenderers }`) — no import-time registry mutation, so production output does not depend on module import order and tests can exercise the exact table production uses. Adding a new node type = adding one renderer entry; adding a new HTML transform (math, code highlighting, link normalization) = adding one step to the pipeline array.

Section level mapping: clause/annex/references/floating_title with `level: N` render as `<h(N+1)>` (page title is the only `<h1>`). See `src/lib/heading-levels.ts`. The loader's `stripFirstHeadingIf` option drops a redundant in-body title at the renderer level.

## Attributes System

Document-attribute reference pages are model-driven, not mirror pages:

- `attributes/{standoc,iso,ietf,ietf-v2}.yaml` — per-flavor manifests (flavor/label/inherits_from/attributes; per-attribute category/type/values/default/required/repeatable/added_in{component,version}/example/description/applies_to). Extracted from the flavor gems by `scripts/extract-attributes.rb` (library `scripts/extract_attributes.rb` + `scripts/extract_attributes/`, specs in `spec/scripts/`).
- Consumed by the `attributes` content collection (`src/content.config.ts`, schema `src/lib/attr-schema.ts`).
- Merged by `src/lib/attributes.ts` — standoc inheritance, override-wins, applies_to subset filtering.
- Rendered by `src/components/AttributeRef.astro` + `AttrEntry.astro` (chips: applicability/version/required/type/default; anchors; filter input) at `src/pages/author/ref/document-attributes.astro` and `src/pages/flavors/[id]/ref/[page].astro`.
- Route registry: `src/lib/attr-registry.ts` (also generates the legacy `/author/{flavor}/ref/…` redirects; dependency-free because `astro.config.mjs` imports it at config load).
- The four old hand-written `.adoc` pages are SUPERSEDED (on disk, filtered at collection). Prose companions stay live: `flavors/iso/ref/identifier-patterns.adoc`, `flavors/ietf/ref/global-options.adoc`.
- To add a flavor's attribute reference: generate `attributes/<flavor>.yaml` with the extraction script + add one `attr-registry.ts` entry.
- **Authoring guide**: `attributes/README.md` (field reference, type vocabulary, applicability, validator-parity rule). The manifest contract is the YAML schema `schemas/attribute-manifest.schema.yaml` (SSOT — the zod model is generated from it) — see "YAML Data Schemas".

## YAML Data Schemas

Every kind of YAML data has a formal schema in `schemas/` — **written in YAML (JSON Schema draft 2020-12 in YAML form), the single source of truth**. Runtime models are derived, never maintained in parallel: `scripts/build-schemas.mjs` generates the zod modules (`src/lib/attr-schema.generated.ts`, `src/lib/frontmatter-schema.generated.ts`) from the YAML schemas via `scripts/lib/yaml-zod-codegen.mjs`. Full map and field references in `schemas/README.md`:

- `attributes/*.yaml` → `attribute-manifest.schema.yaml` (SSOT for the generated zod attribute model)
- Page frontmatter → `frontmatter.schema.yaml` (SSOT for the generated zod frontmatter model)
- `src/config/sections.yml` → `sections.schema.yaml` (validation-only contract for `Convert::Section`)
- `**/_nav.yml` → `nav.schema.yaml` (validation-only contract for `src/lib/nav-tree.ts`)
- `src/config/root-labels.yml` → `root-labels.schema.yaml`

Validation: `npm run check:schemas` (shared core `scripts/lib/schema-check.mjs`; also a vitest suite and two CI gates: schema validation + generated-code drift via `node scripts/build-schemas.mjs --check`). Editor wiring: `# yaml-language-server: $schema=` modelines + `.vscode/settings.json` associations. Adding a new YAML kind = schema + one `CHECKS` entry (+ one `TARGETS` entry for a generated zod module) + README row.

## Critical Constraints

- **NEVER use `asciidoctor` or `antora`** — the only approved AsciiDoc tool is **coradoc** (installed via `gem "coradoc-adoc"` in the `Gemfile`). If coradoc has a bug, fix coradoc upstream and bump the gem version. Report bugs at `scripts/coradoc-bug-report.md`.
- **NEVER delete source files** — `.adoc` files are source; converted mirror-json files are derived output. Superseded content goes in the `SUPERSEDED` table (`scripts/convert/path_mapping.rb`), not the trash. Full rule in global `~/.claude/CLAUDE.md`.
- **NEVER commit to main, push tags, or merge to main** — use PRs.
- **NEVER add AI attribution** (`Co-authored-by:`, `Generated with`, etc.) to commits or PRs.
- **NEVER use `double()` in specs** — use real instances or `Struct.new`.
- **NEVER hand-roll `to_h`/`from_h`/`to_json`/`from_json` on model classes** — use lutaml-model framework.
- Ruby code: use `autoload`, never `require_relative` for internal library code.
- When the converter changes a path, `redirect_from:` is auto-injected for snake_case production URLs. Static redirects live in `STATIC_LEGACY_REDIRECTS` in `astro.config.mjs`. Per-content redirects are auto-discovered via `src/config/redirects-from-content.mjs`. Never delete or rename a page without a redirect.

## Where Things Live

| Need | Location |
|------|----------|
| Convert adoc → mirror-json | `scripts/convert-adoc.rb` (run via `npm run convert`) |
| Section registry (SSOT) | `src/config/sections.yml` |
| Astro config (integrations, redirects) | `astro.config.mjs` |
| Astro content collection schemas | `src/content.config.ts` |
| Mirror loader | `src/content/loaders/mirror-loader.ts` |
| Render pipeline / base renderers | `src/lib/render-pipeline.ts`, `src/lib/mirror-renderer.ts` |
| Catalog data (flavors, software, posts, home) | `src/data/` |
| Header nav + footer config | `src/config/site.ts` |
| Sidebar trees | Per-directory `_nav.yml`, resolved by `src/lib/nav-tree.ts` |
| Attribute manifests | `attributes/*.yaml` (extracted by `scripts/extract-attributes.rb`; guide: `attributes/README.md`) |
| YAML data schemas | `schemas/*.schema.yaml` (SSOT; map: `schemas/README.md`); validation: `scripts/lib/schema-check.mjs`; zod codegen: `scripts/lib/yaml-zod-codegen.mjs` |
| Attribute routes/merge/render | `src/lib/attr-registry.ts`, `src/lib/attributes.ts`, `src/components/AttributeRef.astro` |
| Hand-authored Markdown pages | `src/pages/*.md` |
| Vue islands | `src/components/*.vue` (DarkToggle, MobileMenu, SearchButton) |
| Build output | `dist/` (Astro prerender + pagefind index) |
| Static assets | `public/` |
| Conversion manifest | `mirror-json/manifest.json` |
| Nav orphan gate | `scripts/check-nav.mjs` (`npm run check:nav`) |
| URL diff against prod | `comm -23 <(curl …/sitemap-index.xml URLs) <(dist/sitemap-0.xml URLs)` |

## CI / Production Validation

`.github/workflows/build.yml` builds PRs and `main`, deploying to GitHub Pages on `main` only. Gate order: `bundle exec rspec` → `npm test` (vitest) → `npm run check:nav` → `npm run check:schemas` → `node scripts/build-schemas.mjs --check` → `npm run check` (astro check) → `bundle exec rake sync` → `npm run build` → `node scripts/verify-content.mjs`. Link checking lives in `.github/workflows/links.yml`.

To validate path coverage against production:

```bash
curl -s https://www.metanorma.org/sitemap-0.xml | grep -oE '<loc>[^<]+</loc>' | \
  sed 's|^<loc>https://www.metanorma.org||; s|</loc>$||' | sort > /tmp/prod_urls.txt
npm run build
grep -oE '<loc>[^<]+</loc>' dist/sitemap-0.xml | \
  sed 's|^<loc>https://www.metanorma.org||; s|</loc>$||' | sort > /tmp/local_urls.txt
comm -23 /tmp/prod_urls.txt /tmp/local_urls.txt    # URLs in prod but missing locally
```

## Information Architecture

### Header nav & footer

`src/config/site.ts` — Get Started / Docs / Flavors / Developers / Blog. The Flavors item carries `mega: true`; `Nav.astro` renders it as a wide mega-menu grouped by category and filtered to flavors that have docs in the mirror collection. Dropdowns are CSS-only (`:hover` + `:focus-within`). `MobileMenu.vue` takes over below the md breakpoint. Footer columns are curated in the same file.

### Sidebar

Sidebars are declarative: each directory in a nav-root section has a `_nav.yml`, resolved by `src/lib/nav-tree.ts` (lazy `getNavTrees()`, longest-prefix match, `dir:` inlining of subdirectory trees, `output_prefix` mapping for sections whose source dir differs from their URL prefix, e.g. install). Sidebar roots = sections with `nav_root: true` in `src/config/sections.yml`. `sidebarFor(pathname)` in `src/config/site.ts` delegates to `resolveNavTree`. Gate: `npm run check:nav` (`scripts/check-nav.mjs`) fails on any converted page not declared in a `_nav.yml`; it parses the `SUPERSEDED` table from `scripts/convert/path_mapping.rb` so superseded pages are exempt.

### Page TOC (right side)

`TOC.astro` reads pre-computed headings from the collection entry (extracted by `mirror-loader.ts` at build time). Shows h2/h3/h4 as a right-side sticky TOC when there are 2+ headings. Page title is the only h1 (see `src/lib/heading-levels.ts`). Progressive enhancement: tiny inline `<script>` adds scroll-spy without any framework.

### Heading hierarchy

Page title (from frontmatter `title:`) is rendered as `<h1>` by `Article.astro`. Document sections (clauses, annexes, references, floating titles) render at level N+1 (so a top-level `== Section` becomes `<h2>`, not `<h1>`). See `src/lib/heading-levels.ts` for the mapping.

### Interactive islands

Most of the site is static (zero JS shipped by default). Small Vue islands hydrate only when needed:
- `DarkToggle.vue` (`client:load`) — anti-FOUC theme persistence
- `MobileMenu.vue` — mobile navigation (<md breakpoint)
- `SearchButton.vue` — pagefind UI entry point

Top-nav dropdowns and sidebar collapsibles use native HTML (`<details>`, CSS `:hover`) — no JS.
