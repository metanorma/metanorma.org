# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Site Is

metanorma.org — the public site for the Metanorma standard-document platform. Documentation, blog, flavor index, software catalog, and references.

## Architecture (Astro + Content Collections)

The site is built with [Astro 7](https://astro.build) using vanilla `.astro` components for static output plus small Vue islands for interactivity (dark toggle). Content is delivered via a custom Content Layer loader that reads mirror-json envelopes produced by coradoc.

### Source pipeline

```
.adoc sources at repo root
   ↓ scripts/convert-adoc.rb (Ruby, via coradoc gem)
.vitepress/mirror-json/<key>.json envelopes (AST + frontmatter)
   ↓ src/content/loaders/mirror-loader.ts (custom Astro Content Layer loader)
typed `mirror` collection entries with pre-computed headings + KaTeX-rendered math
   ↓ src/components/MirrorContent.astro (calls src/lib/mirror-renderer.ts)
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
│   │   └── [id].astro
│   ├── software/index.astro
│   └── [...slug].astro     # Catch-all for mirror-json content
├── layouts/
│   └── BaseLayout.astro    # HTML shell, anti-FOUC theme, View Transitions
├── components/             # .astro (static) + .vue (islands)
│   ├── Article.astro       # Page wrapper (title, subtitle, error, slot)
│   ├── MirrorContent.astro # Renders mirror-json AST → HTML
│   ├── Nav.astro, Footer.astro
│   ├── Sidebar.astro       # Left sidebar (native <details> for collapse)
│   ├── TOC.astro           # Right-side TOC (pre-computed headings + scroll-spy)
│   ├── FlavorCard.astro, FlavorGrid.astro, FlavorPage.astro
│   ├── SoftwareGrid.astro
│   └── DarkToggle.vue     # Vue island (client:load)
├── content/
│   └── loaders/
│       └── mirror-loader.ts # Custom loader (single source of truth for mirror-json)
├── content.config.ts       # Collection schema (mirror)
├── lib/                    # Framework-agnostic
│   ├── mirror-renderer.ts  # Renders AST → HTML (OCP registry pattern)
│   ├── heading-levels.ts   # Section level N → <h(N+1)> mapping
│   ├── blog-date.ts        # Ruby/Jekyll date → ISO 8601
│   ├── format-date.ts      # Shared date formatter
│   ├── frontmatter.ts      # YAML frontmatter parsing
│   └── render-math.ts      # KaTeX pre-rendering at build time
├── data/                   # Typed catalog
│   ├── flavors.ts, software.ts, posts.ts, home.ts, types.ts, index.ts
└── config/
    ├── site.ts             # Nav + hand-authored sidebars
    ├── registry.ts         # SidebarRegistry (longest-prefix matching)
    ├── sidebars.generated.json
    └── redirects-from-content.mjs # Extracts redirect_from from mirror-json

scripts/
├── convert-adoc.rb         # Ruby — .adoc → mirror-json (the only build script that remains)
├── sync/                   # rake tasks for upstream content sync
└── verify-content.mjs      # Post-build content parity check

public/                     # Static assets served at / (auto-included)
.vitepress/mirror-json/     # coradoc output (input to mirror-loader)
dist/                       # Astro build output
```

### Routing

- File-based: Astro auto-routes `src/pages/**/*.{astro,md}` to URLs.
- Catch-all `[...slug].astro` looks up `getEntry('mirror', slug)` for any mirror-json entry.
- Specific routes (blog, flavors, software, home, about, get-started, 404) shadow the catch-all.
- Redirects: `astro.config.mjs.redirects` combines static legacy URLs + per-content `redirect_from` (collected at config load via `src/config/redirects-from-content.mjs`).

### What Astro replaces (vs prior vite-ssg setup)

| Old | New |
|---|---|
| `.ssg/router.ts` (110 lines) | File-based routing |
| `vite.config.ts` mdRawLoader | Astro's built-in file handling |
| `scripts/build-sitemap.mjs` | `@astrojs/sitemap` integration |
| `scripts/build-rss.mjs` | `@astrojs/rss` integration |
| `scripts/build-redirects.mjs` | `astro.config.mjs.redirects` |
| `scripts/build-sidebars.mjs` | `Sidebar.astro` reads config directly |
| `scripts/build-clean-urls.mjs` | `trailingSlash: 'always'` config |
| `PageToc.vue` DOM scraping | `TOC.astro` reading pre-computed headings |
| `ArticlePage.vue` | `Article.astro` |
| `SidebarRegistry` Ruby-style class | Static config + Astro component |
| Client-side KaTeX (~250 KB JS) | Pre-rendered in `mirror-loader.ts` |
| Custom `formatDate` duplicated 2x | Single `src/lib/format-date.ts` |

## Common Commands

```bash
npm run convert       # ruby scripts/convert-adoc.rb (incremental)
npm run clean         # convert-adoc.rb --clean (force full rebuild)
npm run dev           # predev runs convert, then astro dev
npm run build         # prebuild runs convert, then astro build + pagefind
npm run preview       # serve the built dist/
npm run check         # astro check (TypeScript diagnostics for .astro files)
npm test              # vitest run
```

`convert-adoc.rb` runs via `bundle exec` from the project root. The `Gemfile` declares `coradoc`, `coradoc-adoc`, and `coradoc-mirror` gems — Bundler resolves and loads them. No local coradoc checkout required.

## Conversion Pipeline (`scripts/convert-adoc.rb`)

The Ruby script converts `.adoc` sources into mirror-json envelopes. Key behaviors:

1. **Source collection**: globs the listed source dirs for `.adoc`. Files in `SUPERSEDED` are filtered out at this step (still kept on disk).
2. **Path mapping** (`map_output_path`): each source dir maps to a fixed output prefix. Production URLs are the canonical target — blog emits `/blog/YYYY-MM-DD-slug`, other paths use kebab-case.
3. **Legacy redirects** (`legacy_redirects_for`): every source file whose kebab output differs from the production snake_case URL gets `redirect_from:` injected automatically.
4. **Frontmatter**: parsed via `Coradoc::CoreModel::FrontmatterBlock::TextSplitter` and `Codec.from_yaml`.
5. **Body**: `Coradoc.parse` → `Coradoc.resolve_includes` → `Coradoc.rewrite_links` (kebab transform + blog prefix).
6. **Empty-body synthesis**: hub pages or placeholders.
7. **Hub synthesis pass**: directories with .md children but no index get a synthesized hub page.
8. **Model-diagram pass**: each `_specs/<model>/images/<Name>.png` becomes a stub page.
9. **Asset copy**: images/PDFs/etc. into `public/`, kebab-mapped.
10. **Output**: writes `.vitepress/mirror-json/<key>.json` envelope. The Astro loader reads these directly.
11. **Caching**: skips files whose output is newer than source. `--clean` forces full rebuild.
12. **Manifest**: `pages/.meta/manifest.json` with per-file status.

## Mirror Renderer (`src/lib/mirror-renderer.ts`)

Renders mirror-json envelopes (prosemirror-style AST with `type`, `content`, `text`, `marks`, `attrs`) to HTML. Uses an OCP-compliant registry pattern: each node type has a named renderer function registered in `nodeRenderers`. Adding a new type = adding one entry. Extension points: `registerNodeRenderer(type, fn)`, `lookupNodeRenderer(type)`.

Section level mapping: clause/annex/references/floating_title with `level: N` render as `<h(N+1)>` (page title is the only `<h1>`). See `src/lib/heading-levels.ts`.

## Critical Constraints

- **NEVER use `asciidoctor` or `antora`** — the only approved AsciiDoc tool is **coradoc** (installed via `gem "coradoc-adoc"` in the `Gemfile`). If coradoc has a bug, fix coradoc upstream and bump the gem version. Report bugs at `scripts/coradoc-bug-report.md`.
- **NEVER delete source files** — `.adoc` files are source; converted mirror-json files are derived output. Full rule in global `~/.claude/CLAUDE.md`.
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
| Astro config (integrations, redirects) | `astro.config.mjs` |
| Astro content collection schema | `src/content.config.ts` |
| Mirror loader | `src/content/loaders/mirror-loader.ts` |
| Mirror renderer | `src/lib/mirror-renderer.ts` |
| Catalog data (flavors, software, posts, home) | `src/data/` |
| Site nav + sidebar config | `src/config/site.ts` |
| Hand-authored Markdown pages | `src/pages/*.md` |
| Vue islands | `src/components/*.vue` (DarkToggle, future SearchButton, MobileMenu) |
| Build output | `dist/` (Astro prerender) |
| Static assets | `public/` |
| Conversion manifest | `pages/.meta/manifest.json` |
| URL diff against prod | `comm -23 <(curl …/sitemap.xml) <(local sitemap-0.xml)` |

## CI / Production Validation

The current branch (`rt-vitepress-migration`) is what CI builds and deploys. To validate path coverage against production:

```bash
curl -s https://www.metanorma.org/sitemap.xml | grep -oE '<loc>[^<]+</loc>' | \
  sed 's|^<loc>https://www.metanorma.org||; s|</loc>$||' | sort > /tmp/prod_urls.txt
npm run build
grep -oE '<loc>[^<]+</loc>' dist/sitemap-0.xml | \
  sed 's|^<loc>https://www.metanorma.org||; s|</loc>$||' | sort > /tmp/local_urls.txt
comm -23 /tmp/prod_urls.txt /tmp/local_urls.txt    # URLs in prod but missing locally
```

## Information Architecture

### Sidebar

Each `/<section>/*` page renders the sidebar for its longest-matching prefix (see `SidebarRegistry.resolve` in `src/config/registry.ts`). Per-subsection sidebars (e.g. `/author/basics/`, `/author/topics/`) are auto-generated into `src/config/sidebars.generated.json`. Top-level landing pages have hand-authored sidebars in `src/config/site.ts`.

This per-subsection pattern is **intentional** — different from production's single full-tree sidebar. Local has way more content than prod (25 flavor pages, 19 library pages, 74 author/topics entries). A single full-tree sidebar would be 200+ items.

### Page TOC (right side)

`TOC.astro` reads pre-computed headings from the collection entry (extracted by `mirror-loader.ts` at build time). Shows h2/h3/h4 as a right-side sticky TOC when there are 2+ headings. Page title is the only h1 (see `src/lib/heading-levels.ts`). Progressive enhancement: tiny inline `<script>` adds scroll-spy without any framework.

### Heading hierarchy

Page title (from frontmatter `title:`) is rendered as `<h1>` by `Article.astro`. Document sections (clauses, annexes, references, floating titles) render at level N+1 (so a top-level `== Section` becomes `<h2>`, not `<h1>`). See `src/lib/heading-levels.ts` for the mapping.

### Interactive islands

Most of the site is static (zero JS shipped by default). Small Vue islands hydrate only when needed:
- `DarkToggle.vue` (`client:load`) — anti-FOUC theme persistence

Top-nav dropdowns and sidebar collapsibles use native HTML (`<details>`, CSS `:hover`) — no JS.
