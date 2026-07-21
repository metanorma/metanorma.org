// Route registry for the model-driven attribute reference pages.
//
// The four document-attribute reference pages are rendered from
// attributes/*.yaml manifests (see src/lib/attributes.ts) instead of
// mirror-json. This table is the single source of truth for WHICH page
// is served from WHICH manifest:
//
//   - src/pages/author/ref/document-attributes.astro (standoc page)
//   - src/pages/flavors/[id]/ref/[page].astro      (flavor pages)
//   - astro.config.mjs (legacy /author/{flavor}/ref/... redirects for
//     the flavor pages — the mirror-json entries that used to generate
//     those redirects are superseded)
//
// Zero imports on purpose: astro.config.mjs pulls this in at config
// load time, so it must stay dependency-free.
//
// Keys: the standoc page is keyed by its full URL path; flavor pages
// are keyed `{flavorId}/{page}` (the [id]/ref/[page] route params).
// Titles match the superseded .adoc pages exactly (their frontmatter /
// top-level heading).

export interface AttrPage {
  // Full URL path without leading/trailing slash.
  urlPath: string
  // attributes/{manifestId}.yaml
  manifestId: string
  // Page <h1>/<title>, identical to the superseded page's title.
  title: string
  // Flavor route params; absent for the standoc page.
  flavorId?: string
  page?: string
}

export const ATTRIBUTE_PAGES: readonly AttrPage[] = [
  {
    urlPath: 'author/ref/document-attributes',
    manifestId: 'standoc',
    title: 'Document attributes',
  },
  {
    urlPath: 'flavors/iso/ref/document-attributes',
    manifestId: 'iso',
    title: 'Metanorma ISO document attributes',
    flavorId: 'iso',
    page: 'document-attributes',
  },
  {
    urlPath: 'flavors/ietf/ref/document-attributes',
    manifestId: 'ietf',
    title: 'Document attributes (AsciiRFC v3)',
    flavorId: 'ietf',
    page: 'document-attributes',
  },
  {
    urlPath: 'flavors/ietf/ref/document-attributes-v2',
    manifestId: 'ietf-v2',
    title: 'Document attributes (AsciiRFC v2)',
    flavorId: 'ietf',
    page: 'document-attributes-v2',
  },
]

export const STANDOC_PAGE: AttrPage = ATTRIBUTE_PAGES[0]

// Flavor pages only (served by flavors/[id]/ref/[page].astro).
export const FLAVOR_ATTRIBUTE_PAGES: readonly AttrPage[] =
  ATTRIBUTE_PAGES.filter(p => p.flavorId !== undefined)
