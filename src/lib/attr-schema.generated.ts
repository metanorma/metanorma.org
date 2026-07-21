// GENERATED from schemas/attribute-manifest.schema.yaml by scripts/build-schemas.mjs — DO NOT EDIT.
// The YAML schema is the single source of truth; regenerate with `npm run build:schemas`.
import { z } from 'zod'

// Attribute value kinds — the fixed vocabulary for `type:`.
export const attrTypeSchema = z.enum(["string", "enum", "boolean", "integer", "number", "uri", "date", "comma-list"])

// {component, version} — the gem and release that introduced/deprecated the attribute (e.g. metanorma-iso / v1.3.25). Rendered as a linked version chip.
export const versionRefSchema = z.strictObject({
  "component": z.string(),
  "version": z.string(),
})

// One accepted value of an enum attribute.
export const attrValueSchema = z.strictObject({
  "name": z.string(),
  "description": z.string().optional(),
  "added_in": versionRefSchema.optional(),
  "notes": z.string().optional(),
})

// One document attribute. The record KEY in the manifest is the attribute name (e.g. docstage, fullname{_i}); there is no duplicate name field.
export const attributeSchema = z.strictObject({
  // Display title when it differs from the attribute name.
  "title": z.string().optional(),
  // Top-level grouping on the reference page.
  "category": z.string(),
  // Second-level grouping inside the category.
  "subsection": z.string().optional(),
  "type": attrTypeSchema.optional(),
  // Accepted values (enum attributes).
  "values": z.array(attrValueSchema).optional(),
  // Value applied when the attribute is omitted.
  "default": z.string().optional(),
  // The document cannot be processed without this attribute.
  "required": z.boolean().optional(),
  // Indexed attribute ({_i}).
  "repeatable": z.boolean().optional(),
  "added_in": versionRefSchema.optional(),
  "deprecated_in": versionRefSchema.optional(),
  // Further releases that changed the attribute.
  "version_history": z.array(versionRefSchema).optional(),
  // Header snippet, e.g. ":docstage: 60".
  "example": z.string().optional(),
  // Prose documentation (inline markup subset — see attributes/README.md).
  "description": z.string().optional(),
  // Deep-link anchor when it differs from the attribute name.
  "anchor": z.string().optional(),
  // Other names for the same attribute (alias anchors are emitted).
  "aliases": z.array(z.string()).optional(),
  // This entry is an alias OF another entry (satellite).
  "alias_of": z.string().optional(),
  // Pointer to the entry that actually documents this name.
  "see": z.string().optional(),
  // Legacy mn-* names (alias anchors are emitted).
  "legacy": z.array(z.string()).optional(),
  "deprecated": z.boolean().optional(),
  // Extra caveats, shown as a meta line.
  "notes": z.string().optional(),
  // The source-page term this entry was recovered/normalized from.
  "source_term": z.string().optional(),
  // Flavor ids this attribute applies to. Absent in standoc.yaml = all flavors; absent in a flavor manifest = that flavor only; present = exactly the listed flavors.
  "applies_to": z.array(z.string()).optional(),
})

// Prose block belonging to a category (optionally a subsection).
export const sectionProseSchema = z.strictObject({
  "name": z.string(),
  "subsection": z.string().optional(),
  "prose": z.string(),
})

// The contract for attributes/<flavor>.yaml — machine-readable, per-flavor document-attribute definitions that drive the generated reference pages. This YAML schema is the SINGLE SOURCE OF TRUTH: the zod model (src/lib/attr-schema.generated.ts) is generated from it by scripts/build-schemas.mjs. Authoring guide: attributes/README.md.
export const attrManifestSchema = z.strictObject({
  // Machine id of the flavor ('standoc' for the generic set).
  "flavor": z.string(),
  // Display name of the flavor.
  "label": z.string(),
  // Parent manifest whose attributes are inherited; null for standoc.
  "inherits_from": z.union([z.string(), z.null()]).optional(),
  // The gem implementing these attributes (e.g. metanorma-iso).
  "gem": z.string().optional(),
  // Provenance — the source page/spec the manifest was extracted from.
  "source": z.string().optional(),
  // Top-level pointer rendered under the page intro (e.g. companion-page link).
  "notes": z.string().optional(),
  // Intro prose rendered at the top of the reference page.
  "description": z.string().optional(),
  // Prose blocks belonging to a category (standoc page intros).
  "sections": z.array(sectionProseSchema).optional(),
  // The attributes, keyed by name as typed in the document header.
  "attributes": z.record(z.string(), attributeSchema),
})
