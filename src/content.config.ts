import { defineCollection, z } from 'astro:content'
import { mirrorLoader } from './content/loaders/mirror-loader'

const mirror = defineCollection({
  loader: mirrorLoader(),
  schema: z.object({
    title: z.string(),
    frontmatter: z.record(z.string(), z.any()),
    headings: z.array(z.object({
      depth: z.number(),
      slug: z.string(),
      text: z.string(),
    })),
    source: z.string(),
    redirect_from: z.array(z.string()).default([]),
    mirror_json: z.string(),
    rendered_html: z.string(),
  }),
})

export const collections = { mirror }
