// Collects per-content redirect rules from mirror-json envelopes and
// merges them with the static/derived redirect maps in astro.config.mjs.
//
// Astro's `redirects` config accepts a static map at config load time.
// astro.config.mjs reads the envelopes ONCE (readAllEnvelopes) and hands
// them here — no second walk of mirror-json.
//
// Collision rule (both collectors): one source URL mapping to TWO
// DIFFERENT targets is a build-time error listing every collision. The
// same source mapping to the SAME target twice is a no-op.

// envelopes: MirrorEnvelope[] from src/lib/mirror-store.ts (already read
// by the caller). Returns { '/from/': '/to/' }.
export function collectRedirectFromEntries(envelopes) {
  const out = {}
  const owner = {} // fromUrl → slug that claimed it (for error messages)
  const collisions = []
  for (const env of envelopes) {
    if (!env.redirect_from.length) continue
    const target = `/${env.slug.replace(/^index$/, '')}/`
    for (const from of env.redirect_from) {
      const cleaned = from.replace(/^\//, '').replace(/\/$/, '')
      if (!cleaned) continue
      const fromUrl = `/${cleaned}/`
      if (fromUrl === target) continue
      if (fromUrl in out && out[fromUrl] !== target) {
        collisions.push(`  ${fromUrl} → ${out[fromUrl]} (/${owner[fromUrl]}) vs ${target} (/${env.slug})`)
        continue
      }
      out[fromUrl] = target
      owner[fromUrl] = env.slug
    }
  }
  if (collisions.length) {
    throw new Error(
      `redirect_from collisions — one source URL, two different targets:\n${collisions.join('\n')}\n` +
      'Give each legacy URL exactly one owning page (fix the frontmatter redirect_from).'
    )
  }
  return out
}

// Merge redirect maps left-to-right into one. Each argument is a
// [label, map] pair; the label identifies the map in error messages.
// A source mapping to the SAME target in several maps is fine; a
// source mapping to TWO DIFFERENT targets throws, listing every
// collision with the labels of the maps that claimed it.
export function mergeRedirects(...namedMaps) {
  const out = {}
  const origin = {} // fromUrl → map label that claimed it
  const collisions = []
  for (const [label, map] of namedMaps) {
    for (const [from, to] of Object.entries(map)) {
      if (from in out && out[from] !== to) {
        collisions.push(`  ${from} → ${out[from]} (${origin[from]}) vs ${to} (${label})`)
        continue
      }
      out[from] = to
      origin[from] = label
    }
  }
  if (collisions.length) {
    throw new Error(
      `Redirect collisions — one source URL, two different targets:\n${collisions.join('\n')}`
    )
  }
  return out
}

// Sitemap filter factory: redirect *sources* must not appear in the
// sitemap (only their targets should be indexed). The source set holds
// each redirect source both with and without a trailing slash, and the
// returned predicate mirrors that check for pages Astro emits with or
// without one. Used by astro.config.mjs's sitemap integration.
export function makeSitemapFilter(redirectSourceSet) {
  return (page) => {
    const path = new URL(page).pathname
    return !redirectSourceSet.has(path) && !redirectSourceSet.has(path.replace(/\/$/, ''))
  }
}
