# AGENTS.md — reference_docs/

## OVERVIEW

Document attribute reference pages and their YAML data models. Two main reference pages (Standoc base + ISO flavor) backed by YAML model files.

## STRUCTURE

```
reference_docs/
├── Ref-standoc-document-attributes.adoc   # Base (all-flavor) attribute reference
├── Ref-ISO-document-attributes.adoc       # ISO-specific attribute reference
└── YAML_models/                           # YAML data source files for attributes (7 files)
```

## CONVENTIONS

- **Naming**: `Ref-<Flavor>-document-attributes.adoc` for flavor-specific references
- **YAML models**: live in `YAML_models/`; `.adoc` pages are intended to render from these (scripted — see TODO in files)
- Front-matter: `tags: ["flavor:<Flavor>", "type: Document Attributes"]`

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Base document attributes | `Ref-standoc-document-attributes.adoc` |
| Flavor-specific attributes | `Ref-<Flavor>-document-attributes.adoc` |
| Attribute YAML source data | `YAML_models/` |

## NOTES

- Both existing `.adoc` files have a TODO to script rendering from YAML — the YAML models are the source of truth for attributes, not the `.adoc` prose
