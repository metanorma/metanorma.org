// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { collectRedirectFromEntries, makeSitemapFilter, mergeRedirects } from './src/config/redirects-from-content.mjs'
import { flavors } from './src/data/flavors.ts'
import { readAllEnvelopes } from './src/lib/mirror-store.ts'
import { normalizeDate } from './src/lib/blog-date.ts'
import { ATTRIBUTE_PAGES } from './src/lib/attr-registry.ts'

// Static legacy-redirect rules: the genuinely one-off entries. The
// per-flavor /author/{id}/ and /flavor/{id}/ redirects that used to be
// hand-written here are now generated from the flavor catalog below
// (FLAVOR_HUB_REDIRECTS).
const STATIC_LEGACY_REDIRECTS = {
  '/reference/': '/author/ref/',
  '/reference_docs/': '/author/ref/',
  '/reference/iso-document-attributes/': '/flavors/iso/ref/document-attributes/',
  '/reference/standoc-document-attributes/': '/author/ref/document-attributes/',
  '/reference_docs/Ref-ISO-document-attributes/': '/flavors/iso/ref/document-attributes/',
  '/reference_docs/Ref-standoc-document-attributes/': '/author/ref/document-attributes/',
  '/specs/Draft/': '/specs/',
  '/vcard-format-specification-rendered/': '/flavors/cc/sample/',
  '/software/Core_parts/': '/software/',
  '/software/Metanorma_flavor/': '/software/',
  '/software/interface:CLI/': '/software/',
  '/software/writtenin:Ruby/': '/software/',
  '/software/user:enterprises/': '/software/',
  '/software/user:standardization_bodies/': '/software/',
  '/flavors/pdf-association/': '/flavors/pdfa/',
  '/docs/': '/get-started/',
  // /author/getting-started/ was org-adoption content misplaced in the
  // author area; merged into the developer landing page. The legacy
  // /overview/ and /docs/ variants point at the final target directly
  // (no redirect chains).
  '/author/getting-started/': '/develop/',
  '/overview/getting-started/': '/develop/',
  '/docs/getting-started/': '/develop/',
  // MPFA was removed from the site (not in the flavor catalog); its
  // legacy URLs land on the parent hubs.
  '/author/mpfa/': '/author/',
  '/author/mpfa/authoring/': '/author/',
  '/author/mpfa/sample/': '/author/',
  '/software/metanorma-mpfa/': '/software/',
  // reverse_adoc's registry entry was dropped in the migration (no .adoc
  // source); land its legacy URL on the catalog until it is re-added.
  '/software/reverse-asciidoctor/': '/software/',
  '/library/metanorma-mpfa/': '/software/',
  '/flavors/mpfa/': '/flavors/',
  '/flavors/mpfa/sample/': '/flavors/',
  '/flavors/mpfa/authoring/': '/flavors/',
  // The library section (upstream gem READMEs) is consolidated into the
  // software catalog; every library page redirects to its gem's page.
  '/library/': '/software/',
  '/library/metanorma-bipm/': '/software/metanorma-bipm/',
  '/library/metanorma-bsi/': '/software/metanorma-bsi/',
  '/library/metanorma-cc/': '/software/metanorma-cc/',
  '/library/metanorma-csa/': '/software/metanorma-csa/',
  '/library/metanorma-gb/': '/software/metanorma-gb/',
  '/library/metanorma-iec/': '/software/metanorma-iec/',
  '/library/metanorma-ieee/': '/software/metanorma-ieee/',
  '/library/metanorma-ietf/': '/software/metanorma-ietf/',
  '/library/metanorma-iho/': '/software/metanorma-iho/',
  '/library/metanorma-iso/': '/software/metanorma-iso/',
  '/library/metanorma-itu/': '/software/metanorma-itu/',
  '/library/metanorma-jis/': '/software/metanorma-jis/',
  '/library/metanorma-m3aawg/': '/software/metanorma-m3aawg/',
  '/library/metanorma-nist/': '/software/metanorma-nist/',
  '/library/metanorma-ogc/': '/software/metanorma-ogc/',
  '/library/metanorma-plateau/': '/software/metanorma-plateau/',
  '/library/metanorma-ribose/': '/software/metanorma-ribose/',
  '/library/metanorma-un/': '/software/metanorma-un/',
  // The standalone samples pages moved under their flavor's quick-start.
  '/samples/': '/flavors/',
  '/samples/draft-camelot-holy-grenade/': '/flavors/ietf/sample/',
  '/samples/vcard-format-specification/': '/flavors/cc/sample/',
  // Synced gem README docs (software/<gem>/docs/*) were deleted upstream
  // (the repos removed their docs/ dirs — the maintained equivalents now
  // live in the flavor guides). The stale duplicates were removed; their
  // URLs land on the flavor equivalents.
  '/software/metanorma-iso/docs/': '/flavors/iso/',
  '/software/metanorma-iso/docs/asciiiso-syntax/': '/flavors/iso/topics/markup/',
  '/software/metanorma-iso/docs/guidance/': '/flavors/iso/topics/',
  '/software/metanorma-iso/docs/navigation/': '/flavors/iso/',
  '/software/metanorma-iso/docs/quickstart/': '/flavors/iso/sample/',
  '/software/metanorma-cc/docs/': '/flavors/cc/',
  '/software/metanorma-cc/docs/navigation/': '/flavors/cc/',
  '/software/metanorma-cc/docs/quickstart/': '/flavors/cc/sample/',
  '/software/metanorma-standoc/docs/': '/get-started/',
  '/software/metanorma-standoc/docs/quickstart/': '/get-started/',
}

// Flavor user-name redirects, derived from the canonical Flavor catalog.
const FLAVOR_USER_REDIRECTS = {}
for (const flavor of flavors) {
  const name = flavor.label.toUpperCase()
  FLAVOR_USER_REDIRECTS[`/software/user:${name}/`] = `/flavors/${flavor.id}/`
}

// Per-flavor hub redirects, generated from the canonical Flavor catalog:
//   /author/{id}/ → /flavors/{id}/   (legacy author-area landing pages)
//   /flavor/{id}/ → /flavors/{id}/   (legacy singular "flavor" prefix)
const FLAVOR_HUB_REDIRECTS = {}
for (const flavor of flavors) {
  FLAVOR_HUB_REDIRECTS[`/author/${flavor.id}/`] = `/flavors/${flavor.id}/`
  FLAVOR_HUB_REDIRECTS[`/flavor/${flavor.id}/`] = `/flavors/${flavor.id}/`
}

// Read envelopes ONCE for both redirect builders below (single walk of
// mirror-json, shared with collectRedirectFromEntries).
const envelopes = await readAllEnvelopes()

// Generate /author/{flavor}/{sub}/ → /flavors/{flavor}/{sub}/ redirects
// from the actual mirror-json entries. This catches ALL sub-pages
// (ref/*, topics/*, sample, authoring-guide/*, etc.) without hardcoding
// each one. The flavor id comes from the slug's first two segments —
// one pass over the envelopes, no per-flavor rescan.
const flavorIds = new Set(flavors.map(f => f.id))
const FLAVOR_PATH_REDIRECTS = {}
for (const env of envelopes) {
  const [area, id, ...rest] = env.slug.split('/')
  if (area !== 'flavors' || rest.length === 0 || !flavorIds.has(id)) continue
  const sub = rest.join('/')
  FLAVOR_PATH_REDIRECTS[`/author/${id}/${sub}/`] = `/flavors/${id}/${sub}/`
}

// Legacy /author/{flavor}/ref/… redirects for the attribute reference
// pages. Those used to fall out of FLAVOR_PATH_REDIRECTS above, but the
// pages are now served from attributes/*.yaml manifests (their
// mirror-json envelopes are superseded), so the route registry
// (src/lib/attr-registry.ts) generates them instead. Same source → same
// target as before, so mergeRedirects stays collision-free either way.
const ATTRIBUTE_PAGE_REDIRECTS = {}
for (const p of ATTRIBUTE_PAGES) {
  if (!p.flavorId) continue
  const sub = p.urlPath.slice(`flavors/${p.flavorId}/`.length)
  ATTRIBUTE_PAGE_REDIRECTS[`/author/${p.flavorId}/${sub}/`] = `/${p.urlPath}/`
}

// Legacy per-diagram model pages (/specs/{model}/{Diagram}/) were dropped
// in the migration (the old converter pass that generated them is gone).
// Redirect each to its parent model page, derived from the synced diagram
// PNGs on disk.
const SPEC_DIAGRAM_REDIRECTS = {}
for (const model of readdirSync('specs', { withFileTypes: true })) {
  if (!model.isDirectory()) continue
  const imagesDir = join('specs', model.name, 'images')
  if (!existsSync(imagesDir)) continue
  for (const png of readdirSync(imagesDir)) {
    if (!png.endsWith('.png')) continue
    const name = png.replace(/\.png$/, '')
    SPEC_DIAGRAM_REDIRECTS[`/specs/${model.name}/${name}/`] = `/specs/${model.name}/`
  }
}

// mergeRedirects throws a build-time error when one source URL maps to
// two different targets across any of these maps.
const allRedirects = mergeRedirects(
  ['static legacy', STATIC_LEGACY_REDIRECTS],
  ['flavor user names', FLAVOR_USER_REDIRECTS],
  ['flavor hubs', FLAVOR_HUB_REDIRECTS],
  ['flavor sub-paths', FLAVOR_PATH_REDIRECTS],
  ['attribute pages', ATTRIBUTE_PAGE_REDIRECTS],
  ['spec diagram pages', SPEC_DIAGRAM_REDIRECTS],
  ['content redirect_from', collectRedirectFromEntries(envelopes)],
)

const redirectSourceSet = new Set(Object.keys(allRedirects).flatMap(url => [url, url.replace(/\/$/, '')]))

// Blog post dates → sitemap lastmod (the only content with reliable
// dates; envelopes were already read above for redirects).
const lastmodByPath = new Map()
for (const env of envelopes) {
  if (!env.slug.startsWith('blog/')) continue
  const iso = normalizeDate(env.frontmatter?.date)
  if (iso) lastmodByPath.set(`/${env.slug}/`, iso)
}

export default defineConfig({
  site: 'https://www.metanorma.org',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    sitemap({
      filter: makeSitemapFilter(redirectSourceSet),
      serialize: (item) => {
        const lastmod = lastmodByPath.get(new URL(item.url).pathname)
        return lastmod ? { ...item, lastmod } : item
      },
    }),
    vue(),
  ],
  redirects: allRedirects,
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
