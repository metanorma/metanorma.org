// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import { collectRedirectFromEntries } from './src/config/redirects-from-content.mjs'
import { flavors } from './src/data/flavors.ts'

// Static legacy-redirect rules.
const STATIC_LEGACY_REDIRECTS = {
  '/reference_docs/': '/author/ref/',
  '/reference/iso-document-attributes/': '/flavors/iso/ref/document-attributes/',
  '/reference/standoc-document-attributes/': '/author/ref/document-attributes/',
  '/reference_docs/Ref-ISO-document-attributes/': '/flavors/iso/ref/document-attributes/',
  '/reference_docs/Ref-standoc-document-attributes/': '/author/ref/document-attributes/',
  '/specs/Draft/': '/specs/',
  '/vcard-format-specification-rendered/': '/samples/vcard-format-specification/',
  '/software/Core_parts/': '/software/',
  '/software/Metanorma_flavor/': '/software/',
  '/software/reverse-asciidoctor/': '/software/reverse-adoc/',
  '/software/interface:CLI/': '/software/',
  '/software/writtenin:Ruby/': '/software/',
  '/software/user:enterprises/': '/software/',
  '/software/user:standardization_bodies/': '/software/',
  '/flavors/pdf-association/': '/flavors/pdfa/',
  '/docs/': '/get-started/',
  '/author/mpfa/': '/author/',
  '/author/mpfa/authoring/': '/author/',
  '/author/mpfa/sample/': '/author/',
  '/software/metanorma-mpfa/': '/software/',
  '/author/bipm/': '/flavors/bipm/',
  '/author/bsi/': '/flavors/bsi/',
  '/author/cc/': '/flavors/cc/',
  '/author/csa/': '/flavors/csa/',
  '/author/elf/': '/flavors/elf/',
  '/author/enosema/': '/flavors/enosema/',
  '/author/gb/': '/flavors/gb/',
  '/author/icc/': '/flavors/icc/',
  '/author/iec/': '/flavors/iec/',
  '/author/ieee/': '/flavors/ieee/',
  '/author/ietf/': '/flavors/ietf/',
  '/author/iho/': '/flavors/iho/',
  '/author/iso/': '/flavors/iso/',
  '/author/itu/': '/flavors/itu/',
  '/author/jis/': '/flavors/jis/',
  '/author/m3aawg/': '/flavors/m3aawg/',
  '/author/mbxif/': '/flavors/mbxif/',
  '/author/nist/': '/flavors/nist/',
  '/author/ogc/': '/flavors/ogc/',
  '/author/oiml/': '/flavors/oiml/',
  '/author/pdfa/': '/flavors/pdfa/',
  '/author/plateau/': '/flavors/plateau/',
  '/author/ribose/': '/flavors/ribose/',
  '/author/swf/': '/flavors/swf/',
  '/author/un/': '/flavors/un/',
  '/flavor/bipm/': '/flavors/bipm/',
  '/flavor/bsi/': '/flavors/bsi/',
  '/flavor/cc/': '/flavors/cc/',
  '/flavor/csa/': '/flavors/csa/',
  '/flavor/elf/': '/flavors/elf/',
  '/flavor/enosema/': '/flavors/enosema/',
  '/flavor/gb/': '/flavors/gb/',
  '/flavor/icc/': '/flavors/icc/',
  '/flavor/iec/': '/flavors/iec/',
  '/flavor/ieee/': '/flavors/ieee/',
  '/flavor/ietf/': '/flavors/ietf/',
  '/flavor/iho/': '/flavors/iho/',
  '/flavor/iso/': '/flavors/iso/',
  '/flavor/itu/': '/flavors/itu/',
  '/flavor/jis/': '/flavors/jis/',
  '/flavor/m3aawg/': '/flavors/m3aawg/',
  '/flavor/mbxif/': '/flavors/mbxif/',
  '/flavor/nist/': '/flavors/nist/',
  '/flavor/ogc/': '/flavors/ogc/',
  '/flavor/oiml/': '/flavors/oiml/',
  '/flavor/pdfa/': '/flavors/pdfa/',
  '/flavor/plateau/': '/flavors/plateau/',
  '/flavor/ribose/': '/flavors/ribose/',
  '/flavor/swf/': '/flavors/swf/',
  '/flavor/un/': '/flavors/un/',
}

// Flavor user-name redirects, derived from the canonical Flavor catalog.
const FLAVOR_USER_REDIRECTS = {}
for (const flavor of flavors) {
  const name = flavor.label.toUpperCase()
  FLAVOR_USER_REDIRECTS[`/software/user:${name}/`] = `/flavors/${flavor.id}/`
}

// Generate /author/{flavor}/* → /flavors/{flavor}/* redirects from
// the actual mirror-json entries. This catches ALL sub-pages (ref/*,
// topics/*, sample, authoring-guide/*, etc.) without hardcoding each one.
const { readAllEnvelopes } = await import('./src/lib/mirror-store.ts')
const FLAVOR_PATH_REDIRECTS = {}
const envelopes = await readAllEnvelopes()
for (const env of envelopes) {
  for (const flavor of flavors) {
    const oldPath = `/author/${flavor.id}${env.slug.startsWith(`flavors/${flavor.id}`) ? '/' + env.slug.slice(`flavors/${flavor.id}`.length) : ''}`
    if (oldPath !== `/author/${flavor.id}/` && env.slug.startsWith(`flavors/${flavor.id}/`)) {
      const sub = env.slug.slice(`flavors/${flavor.id}/`.length)
      FLAVOR_PATH_REDIRECTS[`/author/${flavor.id}/${sub}/`] = `/flavors/${flavor.id}/${sub}/`
    }
  }
}

const allRedirects = await (async () => {
  const fromContent = await collectRedirectFromEntries()
  return { ...STATIC_LEGACY_REDIRECTS, ...FLAVOR_USER_REDIRECTS, ...FLAVOR_PATH_REDIRECTS, ...fromContent }
})()

const redirectSourceSet = new Set(Object.keys(allRedirects).flatMap(url => [url, url.replace(/\/$/, '')]))

export default defineConfig({
  site: 'https://www.metanorma.org',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname
        return !redirectSourceSet.has(path) && !redirectSourceSet.has(path.replace(/\/$/, ''))
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
