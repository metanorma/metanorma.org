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
import { renderMirrorToHtml } from '../../lib/mirror-renderer'
import { renderMath } from '../../lib/render-math'
import { renderCode } from '../../lib/render-code'
import { MIRROR_DIR, slugFromFile } from '../../lib/mirror-store'
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

        const rawHtml = renderMirrorToHtml(envelope.mirror_json)
        const mathHtml = renderMath(rawHtml)
        const html = await renderCode(mathHtml)
        const headings = extractHeadings(html)

        const fm = envelope.frontmatter || {}
        const redirect_from = Array.isArray(fm.redirect_from)
          ? fm.redirect_from.map(String)
          : fm.redirect_from
            ? [String(fm.redirect_from)]
            : []

        store.set({
          id: slug,
          data: {
            title: envelope.title || '',
            frontmatter: fm,
            headings,
            source: envelope.source || slug,
            redirect_from,
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

// Extract headings from rendered HTML. Single regex pass; matches
// <hN id="..."> elements emitted by the renderer (N = 2..4 — page
// title is h1 and excluded from TOC).
function extractHeadings(html: string): Array<{ depth: number; slug: string; text: string }> {
  const re = /<h([234])\s+id="([^"]+)"[^>]*>(.*?)<\/h\1>/g
  const out: Array<{ depth: number; slug: string; text: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    out.push({
      depth: Number(m[1]),
      slug: m[2],
      text: stripTags(m[3]),
    })
  }
  return out
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}
