// Custom Astro Content Layer loader for mirror-json envelopes.
//
// Single source of truth for:
//   1. Where mirror-json files live on disk (`mirror-json/`) — the walk
//      itself is mirror-store.readAllEnvelopes (one implementation,
//      shared with posts.ts and astro.config.mjs).
//   2. How envelopes become collection entries: the stored data shape is
//      MirrorEntryData from src/lib/mirror-schema.ts (the ONE envelope
//      model; content.config.ts uses the same zod schema).
//   3. How headings are extracted at build time: the renderer records
//      them while emitting HTML — no DOM scraping. A first heading that
//      duplicates the page title is stripped by the renderer itself
//      (stripFirstHeadingIf), replacing the old indexOf/substring HTML
//      surgery, which dropped headings[0] even when the HTML strip did
//      not fire.
//
// Pages get headings for free from the collection entry — no DOM
// scraping at request time. Replaces the client-side PageToc.vue
// scraper (~180 lines) and centralizes "what's in a mirror-json page".

import { defaultPipeline } from '../../lib/render-pipeline'
import { mapConcurrent, readAllEnvelopes, type MirrorEnvelope } from '../../lib/mirror-store'
import type { MirrorEntryData } from '../../lib/mirror-schema'
import type { Loader, LoaderContext } from 'astro/loaders'

// Render concurrency: pipeline.run awaits shiki/highlight work, so
// sequential rendering is the loader bottleneck. Batched under
// Promise.all; results keep glob order (mapConcurrent preserves it),
// and store.set is keyed by id, so insertion order is irrelevant anyway.
const RENDER_CONCURRENCY = 16

async function renderEntry(envelope: MirrorEnvelope): Promise<{ id: string; data: MirrorEntryData }> {
  const { html, headings } = await defaultPipeline.run(envelope.mirror_json, {
    stripFirstHeadingIf: envelope.title || undefined,
  })
  return {
    id: envelope.slug,
    data: {
      title: envelope.title,
      frontmatter: envelope.frontmatter,
      headings,
      source: envelope.source,
      redirect_from: envelope.redirect_from,
      mirror_json: envelope.mirror_json,
      rendered_html: html,
    },
  }
}

export function mirrorLoader(): Loader {
  return {
    name: 'mirror-loader',
    async load(ctx: LoaderContext) {
      const { store, logger } = ctx
      // Drop entries from previous runs first: a mirror-json file deleted
      // since the last load must not leave a ghost entry in the store.
      store.clear()

      const envelopes = await readAllEnvelopes({
        onError: (file, err) => logger.warn(`Failed to parse ${file}: ${err.message}`),
      })
      const entries = await mapConcurrent(envelopes, RENDER_CONCURRENCY, renderEntry)
      for (const entry of entries) store.set(entry)

      logger.info(`mirror-loader: ${entries.length} entries synced`)
    },
  }
}
