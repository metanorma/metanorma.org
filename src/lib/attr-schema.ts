// The ONE zod model surface for document-attribute manifests
// (attributes/*.yaml).
//
// The schemas are GENERATED from the YAML single source of truth —
// schemas/attribute-manifest.schema.yaml — by scripts/build-schemas.mjs.
// This module re-exports them and derives the TS types. To change the
// model: edit the YAML schema, run `npm run build:schemas`, commit both.
//
// content.config.ts uses attrManifestSchema as the `attributes`
// collection schema; TS types are INFERRED, never maintained by hand.

import { z } from 'zod'
import {
  attrTypeSchema,
  versionRefSchema,
  attrValueSchema,
  attributeSchema,
  sectionProseSchema,
  attrManifestSchema,
} from './attr-schema.generated'

export {
  attrTypeSchema,
  versionRefSchema,
  attrValueSchema,
  attributeSchema,
  sectionProseSchema,
  attrManifestSchema,
}

export type AttrType = z.infer<typeof attrTypeSchema>
export type AttrVersionRef = z.infer<typeof versionRefSchema>
export type AttrValue = z.infer<typeof attrValueSchema>
export type Attribute = z.infer<typeof attributeSchema>
export type AttrSectionProse = z.infer<typeof sectionProseSchema>
export type AttrManifest = z.infer<typeof attrManifestSchema>
