// The ONE envelope/frontmatter model for mirror-json content.
//
// frontmatterSchema / frontmatterAuthorSchema are GENERATED from the YAML
// single source of truth — schemas/frontmatter.schema.yaml — by
// scripts/build-schemas.mjs (edit the YAML, not the .generated.ts).
// The envelope shapes below (headings, collection entry) are build
// artifacts, not YAML-authored data, so they stay hand-maintained here.
//
//   - frontmatterSchema: the frontmatter fields pages actually use,
//     plus .passthrough() so any extra frontmatter keys flow through.
//   - mirrorEntrySchema: the stored collection-entry data shape
//     (content.config.ts uses it as the collection schema).
//   - TS types are INFERRED from the zod schemas — never maintained
//     by hand.
//
// mirror-store.ts keeps its lean disk-read shape (MirrorEnvelope); the
// loader turns envelopes into this schema's shape when it stores them.

import { z } from 'zod'
import { frontmatterSchema, frontmatterAuthorSchema } from './frontmatter-schema.generated'

export { frontmatterSchema, frontmatterAuthorSchema }

export const mirrorHeadingSchema = z.object({
  depth: z.number(),
  slug: z.string(),
  text: z.string(),
})

// The stored data shape of a `mirror` collection entry.
export const mirrorEntrySchema = z.object({
  title: z.string(),
  frontmatter: frontmatterSchema,
  headings: z.array(mirrorHeadingSchema),
  source: z.string(),
  redirect_from: z.array(z.string()).default([]),
  mirror_json: z.string(),
  rendered_html: z.string(),
})

export type MirrorFrontmatterAuthor = z.infer<typeof frontmatterAuthorSchema>
export type MirrorFrontmatter = z.infer<typeof frontmatterSchema>
export type MirrorHeading = z.infer<typeof mirrorHeadingSchema>
export type MirrorEntryData = z.infer<typeof mirrorEntrySchema>
