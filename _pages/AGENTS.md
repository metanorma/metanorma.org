# AGENTS.md — _pages/

## OVERVIEW

Static navigational and landing pages for the site. Distinct from `_posts/` (dated blog) and `author/` (doc content).

## CONVENTIONS

- **Front-matter required**: `layout`, `title`, `permalink`
- **Redirects**: use `redirect_from:` list — NEVER rename/delete a page without it
- `install/` subdirectory: platform-specific install instructions (9 files)
- Most pages use `layout: page` or a named layout like `layout: flavors`

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Edit install instructions | `_pages/install/` |
| Edit flavors listing | `_pages/flavors.adoc` |
| Add site-wide redirect | `redirect_from:` in destination page |
| Author hub page | `_pages/author.adoc` |

## ANTI-PATTERNS

- Do NOT delete or rename pages without `redirect_from:` — causes dead links across the web
- Do NOT put long-form documentation here — use `author/`, `develop/`, or `learn/`
