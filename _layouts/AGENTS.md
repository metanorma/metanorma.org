# AGENTS.md — _layouts/

## OVERVIEW

Liquid + HTML layout templates for the Jekyll site. Most layouts come from `jekyll-theme-open-project`; files here are project-specific overrides and flavor templates.

## CONVENTIONS

- **Flavor layouts**: `<flavor>-flavor.adoc` — one per Metanorma flavor, required for `author/<flavor>.adoc` landing pages
- **Content layouts**: `page.html`, `home.html`, `author-docs.html`, `develop-docs.html`, `learn.html`
- **Spec layouts**: `spec-sample.html`
- Layouts reference theme partials from `jekyll-theme-open-project` — check theme source before overriding

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add layout for new flavor | Create `<flavor>-flavor.adoc` |
| Override theme layout | Add same-named file here |
| Shared navigation | `nav-links.html` (repo root, not `_includes/`) |

## CRITICAL: includes_dir

`includes_dir: '.'` in `_config.yml` — all `{% include %}` paths resolve from **repo root**, not `_includes/`. So `{% include foo.html %}` looks for `./foo.html`, not `./_includes/foo.html`.

## ANTI-PATTERNS

- Do NOT use `_includes/`-relative paths in `{% include %}` tags — they resolve from root
- Do NOT delete flavor layouts without removing the matching `author/<flavor>.adoc` pages
