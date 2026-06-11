# AGENTS.md — author/

## OVERVIEW

Central authoring documentation hub. Contains per-flavor guides, cross-flavor topic guides, basics, and editors' guide.

## STRUCTURE

```
author/
├── basics/          # Core AsciiDoc concepts for Metanorma (12 files)
├── topics/          # Cross-flavor topic guides (blocks, sections, metadata, etc.)
├── editors-guide/   # Tips for editors reviewing Metanorma documents
├── <flavor>/        # Per-flavor authoring guide (iso, ietf, ogc, iho, ieee, itu, gb, …)
│   ├── <flavor>.adoc        # Flavor landing page
│   ├── authoring-guide/     # Step-by-step guides
│   ├── topics/              # Flavor-specific topic pages
│   └── ref/                 # Flavor-specific reference pages
└── getting-started.adoc     # Entry-point for new users
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Cross-flavor AsciiDoc concepts | `author/basics/` |
| Block, section, inline markup guides | `author/topics/<topic>/` |
| Flavor-specific authoring | `author/<flavor>/` |
| Editor tips and review workflow | `author/editors-guide/` |
| New user entry point | `author/getting-started.adoc` |

## CONVENTIONS

- Each flavor directory mirrors the same shape: `<flavor>.adoc` landing + `authoring-guide/` + optional `topics/` + optional `ref/`
- Flavor landing pages (`author/<flavor>.adoc`) use `layout: <flavor>-flavor` in front-matter
- `author/ref/` contains shared reference material linked from multiple flavors
- Cross-references between flavors: use root-relative URLs (e.g., `/author/iso/`) not relative paths

## ADDING A FLAVOR

1. Create `author/<flavor>.adoc` with `layout: <flavor>-flavor`
2. Create `author/<flavor>/authoring-guide/` directory with guide pages
3. Add `_layouts/<flavor>-flavor.adoc` layout template
4. Add `_software/metanorma-<flavor>.adoc` registry entry
5. Flavor abbreviation is lowercase; must match `--type` CLI flag

## ANTI-PATTERNS

- Do NOT add flavor-specific content to `author/basics/` — basics is cross-flavor only
- Do NOT use absolute URLs to `metanorma.org` for internal cross-references
- Do NOT delete flavor landing pages without `redirect_from:` in the replacement
