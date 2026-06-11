# AGENTS.md — _specs/

## OVERVIEW

Metanorma data model specifications. Each flavor has a `metanorma-model-<flavor>/` directory with UML images and a summary `.adoc` file.

## STRUCTURE

```
_specs/
├── metanorma-model-<flavor>/    # UML diagrams (PNG/SVG) for a flavor's data model
│   └── images/                  # Model images referenced from the .adoc summary
└── metanorma-model-<flavor>.adoc  # Summary page with embedded images
```

## CONVENTIONS

- **Naming**: `metanorma-model-<flavor>.adoc` + matching `metanorma-model-<flavor>/` directory
- **Images**: place in `metanorma-model-<flavor>/images/` and reference relatively from the `.adoc`
- **Front-matter**: `layout: spec-sample` (or equivalent spec layout)
- `draft-ribose-asciirfc.adoc` is an AsciiRFC spec, not a data model — treated separately

## ANTI-PATTERNS

- Do NOT place spec images outside the matching `images/` subdirectory
- Do NOT add non-spec content (authoring guides, tutorials) to this directory
