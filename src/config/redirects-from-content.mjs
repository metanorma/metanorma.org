// Reads all mirror-json envelopes and collects `redirect_from` entries
// into a single map. Used by astro.config.mjs to register all
// per-content redirect rules.
//
// Astro's `redirects` config accepts a static map at config load time.
// We scan the build output (mirror-json) once at config load to extract
// per-page redirect_from entries that the converter injected.

import { readAllEnvelopes } from '../lib/mirror-store.ts'

export async function collectRedirectFromEntries() {
  const out = {}
  const envelopes = await readAllEnvelopes()
  for (const env of envelopes) {
    if (!env.redirect_from.length) continue
    const target = `/${env.slug.replace(/^index$/, '')}/`
    for (const from of env.redirect_from) {
      const cleaned = from.replace(/^\//, '').replace(/\/$/, '')
      if (!cleaned) continue
      const fromUrl = `/${cleaned}/`
      if (fromUrl !== target) {
        out[fromUrl] = target
      }
    }
  }
  return out
}
