# AGENTS.md — specs/

## OVERVIEW

Metanorma data model specifications. Each flavor has a `metanorma-model-<flavor>/` directory with UML images and a summary `.adoc` file.

## STRUCTURE

```
specs/
├── metanorma-model-<flavor>/    # UML diagrams (PNG/SVG) for a flavor's data model
│   └── images/                  # Model images referenced from the .adoc summary
└── metanorma-model-<flavor>.adoc  # Summary page with embedded images
```

## CONVENTIONS

- **Naming**: `metanorma-model-<flavor>.adoc` + matching `metanorma-model-<flavor>/` directory
- **Images**: live in `metanorma-model-<flavor>/images/`, referenced relatively from the `.adoc`. They are pulled from the upstream model repos by `bundle exec rake sync` (targets discovered from the `.adoc` frontmatter; clones cached in `_upstream/`)
- The converter generates a stub page for each model image (`specs/<model>/images/<Name>.png` → diagram page)
- `draft-ribose-asciirfc.adoc` is an AsciiRFC spec, not a data model — treated separately

## ANTI-PATTERNS

- Do NOT place spec images outside the matching `images/` subdirectory
- Do NOT add non-spec content (authoring guides, tutorials) to this directory
- Do NOT manually edit `specs/*/` subdirectories — they are synced by `rake sync` and gitignored (only the top-level `.adoc` sources are committed)
