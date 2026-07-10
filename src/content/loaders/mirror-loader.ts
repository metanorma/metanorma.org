// Custom Astro Content Layer loader for mirror-json envelopes.
//
// Single source of truth for:
//   1. Where mirror-json files live on disk (`mirror-json/`).
//   2. How to parse the envelope (source, frontmatter, title, mirror_json).
//   3. How to extract headings at build time (calls the renderer once,
//      scrapes <h2>/<h3>/<h4> from the rendered HTML).
//
// Pages get headings for free from the collection entry — no DOM
// scraping at request time. Replaces the client-side PageToc.vue
// scraper (~180 lines) and centralizes "what's in a mirror-json page".

import { glob } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultPipeline } from '../../lib/render-pipeline'
import { extractRedirects, MIRROR_DIR, slugFromFile } from '../../lib/mirror-store'
import type { Loader, LoaderContext } from 'astro/loaders'

interface RawEnvelope {
  source: string
  frontmatter: Record<string, any>
  title: string
  mirror_json: string
}

export interface MirrorEntry {
  title: string
  frontmatter: Record<string, any>
  headings: Array<{ depth: number; slug: string; text: string }>
  source: string
  redirect_from: string[]
  mirror_json: string
  rendered_html: string
}

export function mirrorLoader(): Loader {
  return {
    name: 'mirror-loader',
    async load(ctx: LoaderContext) {
      const { store, logger } = ctx
      let count = 0

      for await (const file of glob('**/*.json', { cwd: MIRROR_DIR })) {
        const fullPath = join(MIRROR_DIR, file)
        let envelope: RawEnvelope
        try {
          envelope = JSON.parse(readFileSync(fullPath, 'utf-8'))
        } catch (err) {
          logger.warn(`Failed to parse ${file}: ${(err as Error).message}`)
          continue
        }

        const slug = slugFromFile(file)
        const { html: rawHtml, headings: rawHeadings } = await defaultPipeline.run(envelope.mirror_json)
        const fm = envelope.frontmatter || {}

        const title = envelope.title || ''
        let html = rawHtml
        let headings = rawHeadings

        if (title && headings.length > 0 && headings[0].text.trim() === title.trim()) {
          const first = headings[0]
          const openTag = `<h${first.depth}`
          const closeTag = `</h${first.depth}>`
          const startIdx = html.indexOf(openTag)
          if (startIdx >= 0) {
            const tagEnd = html.indexOf('>', startIdx)
            const closeIdx = html.indexOf(closeTag, tagEnd)
            if (closeIdx >= 0 && html.substring(startIdx, tagEnd).includes(`id="${first.slug}"`)) {
              const afterClose = closeIdx + closeTag.length
              html = html.substring(0, startIdx) + html.substring(afterClose).replace(/^\s+/, '')
            }
          }
          headings = headings.slice(1)
        }

        store.set({
          id: slug,
          data: {
            title,
            frontmatter: fm,
            headings,
            source: envelope.source || slug,
            redirect_from: extractRedirects(fm),
            mirror_json: envelope.mirror_json,
            rendered_html: html,
          } satisfies MirrorEntry,
        })
        count++
      }

      logger.info(`mirror-loader: ${count} entries synced`)
    },
  }
}
