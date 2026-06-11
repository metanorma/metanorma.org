# AGENTS.md — author/topics/

## OVERVIEW

Cross-flavor topic guides covering AsciiDoc markup areas that apply to all Metanorma flavors.

## STRUCTURE

```
topics/
├── blocks/           # Block elements (19 files — largest topic)
├── sections/         # Document section types (9 files)
├── inline_markup/    # Inline formatting (7 files)
├── automation/       # Automation features (6 files)
├── collections/      # Document collections
├── document-format/  # Output format and formatting
├── metadata/         # Document metadata / front-matter attributes
└── output/           # Output generation
```

## CONVENTIONS

- Each topic area: a `<topic>.adoc` index page + `<topic>/` directory of detail pages
- Pages use `layout: author-docs`
- Cross-references within topics: relative paths; cross-topic: root-relative (`/author/topics/...`)
- Add new topic: create `<topic>.adoc` + `<topic>/` directory; link from `author/topics.adoc`

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Block markup (tables, lists, examples) | `blocks/` |
| Section types (terms, bibliography, etc.) | `sections/` |
| Inline formatting (bold, links, xrefs) | `inline_markup/` |
| Automation / Lutaml / data-driven docs | `automation/` |
| Output format options | `document-format/` or `output/` |

## ANTI-PATTERNS

- Do NOT add flavor-specific content here — flavor topics go in `author/<flavor>/topics/`
- Do NOT create a topic file without a matching directory if it has sub-pages
