import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { mirrorLoader } from './content/loaders/mirror-loader'
import { mirrorEntrySchema } from './lib/mirror-schema'
import { attrManifestSchema } from './lib/attr-schema'

const mirror = defineCollection({
  loader: mirrorLoader(),
  // The one shared envelope model — see src/lib/mirror-schema.ts.
  schema: mirrorEntrySchema,
})

// Document-attribute manifests (attributes/*.yaml) — the model behind the
// generated attribute reference pages (see src/lib/attr-registry.ts for
// the route table and src/lib/attributes.ts for the merge logic). Entry
// ids are the file stems: standoc, iso, ietf, ietf-v2.
const attributes = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './attributes' }),
  // The one manifest model — see src/lib/attr-schema.ts.
  schema: attrManifestSchema,
})

export const collections = { mirror, attributes }
