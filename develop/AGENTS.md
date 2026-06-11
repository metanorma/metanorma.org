# AGENTS.md — develop/

## OVERVIEW

Developer documentation for Metanorma contributors and integrators. Covers architecture, contribution workflows, and tooling internals.

## STRUCTURE

```
develop/
├── topics/    # Developer topic guides (9 files)
└── ref/       # Developer reference material
```

## CONVENTIONS

- Front-matter: `layout: develop-docs`
- Audience is developers extending or integrating Metanorma, not end-user authors
- Cross-references to author docs: use root-relative URLs (`/author/...`)

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add developer topic guide | `develop/topics/<topic>.adoc` |
| Developer reference material | `develop/ref/` |

## ANTI-PATTERNS

- Do NOT put end-user authoring content here — that belongs in `author/`
- Do NOT use `layout: author-docs` — developer pages use `layout: develop-docs`
