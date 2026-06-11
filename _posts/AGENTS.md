# AGENTS.md — _posts/

## OVERVIEW

Blog posts for metanorma.org. 86 date-prefixed AsciiDoc files; rendered at `/blog/YYYY-MM-DD-title/`.

## CONVENTIONS

- **Filename**: `YYYY-MM-DD-slug.adoc` — date prefix is mandatory, drives permalink
- **Front-matter required keys**: `layout: post`, `title`, `date`, `author`
- **Images**: store in `assets/blog/YYYY-MM-DD/` matching the post date — do NOT inline or put elsewhere
- **Hoverable image widget**: add `extra_scripts: [src: /assets/js/hoverable-illustrations.js]` to front-matter, then use `[.hoverable]` block with a `[link=...]` on the image macro

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add new post | Create `_posts/YYYY-MM-DD-slug.adoc` |
| Post images | `assets/blog/YYYY-MM-DD/` |
| Hoverable image JS | `assets/js/hoverable-illustrations.js` |

## ANTI-PATTERNS

- Do NOT put blog images outside `assets/blog/YYYY-MM-DD/`
- Do NOT omit the date prefix in filenames — Jekyll permalink generation depends on it
- Do NOT use `layout: page` — posts require `layout: post`
