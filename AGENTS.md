# AGENTS.md — metanorma.org

**Generated:** 2026-06-11
**Branch:** 20260528
**Repo:** https://github.com/metanorma/metanorma.org

## OVERVIEW

Jekyll-based documentation site for Metanorma — the standards authoring toolchain. Uses `jekyll-theme-open-project` theme with `jekyll-asciidoc` for AsciiDoc content processing. Deployed to GitHub Pages via CI.

## STRUCTURE

```
metanorma.org/
├── _posts/          # Blog posts (86 files, date-prefixed .adoc)
├── _layouts/        # HTML layout templates (Liquid + HTML)
├── _pages/          # Static pages (install, flavors, author, etc.)
├── _software/       # Software registry entries (.adoc with YAML front-matter)
├── _specs/          # Metanorma data model specs (UML images + .adoc summaries)
├── _sass/           # SCSS overrides (metanorma-rules.scss)
├── _includes/       # Shared HTML fragments
├── author/          # Author documentation hub (largest content area)
│   ├── basics/      # AsciiDoc fundamentals for Metanorma
│   ├── topics/      # Topic guides (blocks, sections, inline markup, etc.)
│   ├── <flavor>/    # Per-flavor authoring guides (iso, ietf, ogc, iho, ieee…)
│   └── editors-guide/
├── develop/         # Developer documentation (topics/)
├── learn/           # Tutorial content (lessons/ + exercises_code/)
├── reference_docs/  # Document attribute references (.adoc + YAML_models/)
├── assets/          # Static assets (blog images, JS, CSS, author images)
└── parent-hub/      # Ribose Open Project hub integration
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add/edit blog post | `_posts/YYYY-MM-DD-title.adoc` |
| Add flavor docs | `author/<flavor>/` + `_layouts/<flavor>-flavor.adoc` |
| Edit site navigation | `_pages/` + `_config.yml` |
| Register software project | `_software/<name>.adoc` |
| Add data model spec | `_specs/metanorma-model-<flavor>/` |
| Edit theme/styles | `_sass/metanorma-rules.scss` |
| Add redirect | `redirect_from:` in target page's front-matter |
| Author topic guides | `author/topics/<topic>/` |
| Dev documentation | `develop/topics/` |
| Tutorial content | `learn/lessons/` and `learn/exercises_code/` |

## CONTENT CONVENTIONS

- **Primary format**: AsciiDoc (`.adoc`) processed by `jekyll-asciidoc`
- **Front-matter**: YAML; required keys vary by collection (see per-dir notes)
- **Blog images**: `assets/blog/<YYYY-MM-DD>/` matching post date
- **Hoverable images**: Use `[.hoverable]` block + `extra_scripts: hoverable-illustrations.js`
- **Redirects**: Add `redirect_from:` to destination page front-matter — NEVER delete pages without it
- **Branch naming**: `doc<YYYYMMDD>` for doc branches, `rt-<description>` for feature/fix branches
- **Cross-references**: Use relative paths within the same collection; avoid absolute URLs to own site

## FLAVOR STRUCTURE (CRITICAL)

Each Metanorma flavor needs:
1. `author/<flavor>.adoc` — flavor landing page
2. `author/<flavor>/` — authoring guide directory
3. `_layouts/<flavor>-flavor.adoc` — layout template
4. `_software/metanorma-<flavor>.adoc` — software registry entry

Flavor abbreviation ≠ org abbreviation (e.g., M3AAWG flavor = `m3aawg`). The `--type` CLI flag matches the lowercase flavor abbreviation.

## ABSOLUTE RULE: NEVER USE ASCIIDOCTOR OR ANTORA

- **NEVER use `asciidoctor`** (Ruby gem, JS npm package `@asciidoctor/core`, or any other binding). Not for rendering, not for conversion, not as fallback.
- **NEVER use `antora`** or any Antora components (`@antora/*`).
- The ONLY approved tool for AsciiDoc processing is **coradoc** (installed via the `Gemfile` — `gem "coradoc-adoc"`). If coradoc has a bug, fix coradoc upstream and bump the gem version.
- The pipeline is: `.adoc` → coradoc parse → CoreModel → coradoc-mirror → ProseMirror JSON → Astro renderer.
- This rule applies to ALL projects, ALL sessions, forever.

## ANTI-PATTERNS

- **Never delete or rename pages** without adding `redirect_from:` to avoid dead links
- **Never commit directly to `main`** — use PRs via feature branches
- **Never push tags** — CI handles releases
- **`_site/`** is build output, gitignored — do not edit or commit
- **`parent-hub/`** is auto-generated from `parent_hub` config — do not manually edit
- `_software/*/.git`, `_software/*/docs`, `_software/*/_*_repo` are cloned at build time — gitignored

## COMMANDS

```bash
make bundle          # Install gems (first-time setup)
make                 # Build site → _site/
make serve           # Build + serve with live reload at localhost:4000
make clean           # Remove _site/ and cloned software repos
bundle exec jekyll build --trace   # Verbose build
```

**CI**: `.github/workflows/build_deploy.yml` — builds on all PRs, deploys to GitHub Pages on `main` push only.
**Link checking**: `.github/workflows/links.yml`

## NOTES

- Theme: `jekyll-theme-open-project` (Ribose) — most layout/styling comes from there
- `jekyll-theme-open-project-helpers` gem (~2.1.9) clones software repos during build
- `includes_dir: '.'` — includes are resolved from repo root, not `_includes/`
- `landing_priority: [custom_intro, blog, specs, software]` controls homepage section order
- Ruby 3.3 required (matches CI config)
- `html-proofer` + `rake` available for local link validation
