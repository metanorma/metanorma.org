// GENERATED from schemas/frontmatter.schema.yaml by scripts/build-schemas.mjs — DO NOT EDIT.
// The YAML schema is the single source of truth; regenerate with `npm run build:schemas`.
import { z } from 'zod'

// Blog post author block. Extra keys pass through.
export const frontmatterAuthorSchema = z.object({
  "name": z.string().optional(),
  "use_picture": z.string().optional(),
  "social_links": z.array(z.string()).optional(),
}).passthrough()

// The contract for the YAML frontmatter block of .adoc content pages (title, description, redirect_from, blog metadata, …). This YAML schema is the SINGLE SOURCE OF TRUTH: the zod model (src/lib/frontmatter-schema.generated.ts) is generated from it by scripts/build-schemas.mjs. Extra keys are allowed and preserved verbatim.
export const frontmatterSchema = z.object({
  // Page title — rendered as the only <h1>.
  "title": z.string().optional(),
  "subtitle": z.string().optional(),
  // Meta/OG description (SEO fallback chain).
  "description": z.string().optional(),
  // Blog excerpt; second in the description fallback chain.
  "excerpt": z.string().optional(),
  // Post date; the converter emits ISO strings (date or datetime).
  "date": z.string().optional(),
  "published_at": z.string().optional(),
  "author": frontmatterAuthorSchema.optional(),
  // Per-page social image (overrides the default OG card).
  "card_image": z.string().optional(),
  // Legacy URLs that redirect to this page; scalar or list.
  "redirect_from": z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough()
