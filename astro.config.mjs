// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import { collectRedirectFromEntries } from './src/config/redirects-from-content.mjs'
import { flavors } from './src/data/flavors.ts'

// Static legacy-redirect rules.
const STATIC_LEGACY_REDIRECTS = {
  '/reference_docs/': '/reference/',
  '/specs/Draft/': '/specs/',
  '/vcard-format-specification-rendered/': '/samples/vcard-format-specification/',
  '/software/Core_parts/': '/software/',
  '/software/Metanorma_flavor/': '/software/',
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
}

// Flavor user-name redirects, derived from the canonical Flavor catalog.
// Eliminates dual-maintenance: adding a flavor to flavors.ts auto-generates
// its legacy /software/user:{NAME}/ redirect.
const FLAVOR_USER_REDIRECTS = {}
for (const flavor of flavors) {
  const name = flavor.label.toUpperCase()
  FLAVOR_USER_REDIRECTS[`/software/user:${name}/`] = `/software/${flavor.id}/`
}

const allRedirects = await (async () => {
  const fromContent = await collectRedirectFromEntries()
  return { ...STATIC_LEGACY_REDIRECTS, ...FLAVOR_USER_REDIRECTS, ...fromContent }
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
