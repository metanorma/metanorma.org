# AGENTS.md — author/

## OVERVIEW

Central authoring documentation hub: cross-flavor basics, topic guides, shared reference, and editors' guide. Per-flavor authoring guides do NOT live here anymore — they are in `flavors/<flavor>/` (the old `/author/<flavor>/…` URLs redirect there).

## STRUCTURE

```
author/
├── basics/          # Core AsciiDoc concepts for Metanorma
├── topics/          # Cross-flavor topic guides (blocks, sections, metadata, etc.)
├── ref/             # Shared reference material (linked from multiple flavors)
├── editors-guide/   # Tips for editors reviewing Metanorma documents
├── _nav.yml         # Sidebar tree for the /author/ section
└── getting-started.adoc  # SUPERSEDED (merged into /develop/; kept on disk,
                          # filtered at convert via path_mapping.rb SUPERSEDED)
```

(The `*.md` stubs in this directory are gitignored vite-ssg-era intermediates — ignore them; content flows through `.adoc` → mirror-json.)

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Cross-flavor AsciiDoc concepts | `author/basics/` |
| Block, section, inline markup guides | `author/topics/<topic>/` |
| Shared reference pages | `author/ref/` |
| Document attribute reference | Generated from `attributes/standoc.yaml` — see `src/lib/attr-registry.ts` |
| Flavor-specific authoring | `flavors/<flavor>/` (NOT here) |
| Editor tips and review workflow | `author/editors-guide/` |
| Sidebar for this section | `author/_nav.yml` (checked by `npm run check:nav`) |
| New user entry point | `/get-started/` (`src/pages/get-started.md`) |

## CONVENTIONS

- Every new page must be declared in `author/_nav.yml` (or a subdirectory's `_nav.yml`) — `npm run check:nav` fails on orphans
- Cross-references between flavors: use root-relative URLs (e.g., `/flavors/iso/`) not relative paths
- `author/ref/document-attributes.adoc` is SUPERSEDED — the page at that URL is rendered from `attributes/standoc.yaml`

## ADDING A FLAVOR

1. Create `flavors/<flavor>.adoc` + `flavors/<flavor>/` with the guide pages
2. Add an entry to the flavor catalog `src/data/flavors.ts` (drives cards, mega-menu, and the generated `/author/<flavor>/…` redirects)
3. Add `software/metanorma-<flavor>.adoc` registry entry
4. If it has a document-attribute reference: generate `attributes/<flavor>.yaml` (`scripts/extract-attributes.rb`) + one entry in `src/lib/attr-registry.ts`
5. Flavor abbreviation is lowercase; must match `--type` CLI flag

## ANTI-PATTERNS

- Do NOT add flavor-specific content to `author/basics/` — basics is cross-flavor only
- Do NOT use absolute URLs to `metanorma.org` for internal cross-references
- Do NOT delete pages without `redirect_from:` in the replacement
