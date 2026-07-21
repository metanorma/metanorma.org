# AGENTS.md — reference_docs/

## OVERVIEW

Legacy document attribute reference material. **Nothing here is live content.** The two `.adoc` pages are SUPERSEDED and the YAML models are dormant 2021-era material. The live attribute system is `attributes/*.yaml` (repo root) — machine-readable manifests extracted from the flavor gems by `scripts/extract-attributes.rb`, rendered by `src/components/AttributeRef.astro`.

## STRUCTURE

```
reference_docs/
├── Ref-standoc-document-attributes.adoc   # SUPERSEDED by /author/ref/document-attributes/
├── Ref-ISO-document-attributes.adoc       # SUPERSEDED by /flavors/iso/ref/document-attributes/
└── YAML_models/                           # DORMANT 2021 attribute YAML (7 files)
```

## CONVENTIONS

- Both `.adoc` files are in the `SUPERSEDED` table (`scripts/convert/path_mapping.rb`) — filtered out at conversion time, kept on disk per the never-delete-source rule. The replacement pages are generated from `attributes/*.yaml` (route registry: `src/lib/attr-registry.ts`).
- `YAML_models/` was the 2021 attempt at scripted attribute rendering. It is superseded as the attribute source of truth by `attributes/*.yaml`, which is extracted from the live flavor gems. Do not extend or consume `YAML_models/`.
- The `reference` section in `src/config/sections.yml` (ref_strip mapping) still points here, but with both sources superseded it emits nothing.

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Live attribute manifests | `attributes/<flavor>.yaml` |
| Attribute extraction | `scripts/extract-attributes.rb` |
| Attribute reference pages | `src/pages/author/ref/document-attributes.astro`, `src/pages/flavors/[id]/ref/[page].astro` |
