// SEO model — single source for site-wide search/social metadata.
//
// Consumed by src/components/Seo.astro (head tags) and astro.config.mjs
// (sitemap serialization). Keep every SEO-facing constant here.

import type { Crumb } from './breadcrumbs'

export const SITE = {
  name: 'Metanorma',
  url: 'https://www.metanorma.org',
  defaultDescription:
    'Metanorma is the open-source platform for authoring and publishing ' +
    'standards documents — write once in AsciiDoc, publish to ISO, IEC, ' +
    'IEEE, IETF, and many more flavors.',
  tagline: 'Standards beyond words',
  defaultOgImage: '/assets/og-default.png',
  themeColor: '#575ABE',
  locale: 'en_US',
  language: 'en',
} as const

// Page title → full document title. The homepage passes an absolute
// title (seoTitle) and bypasses the suffix.
export function buildTitle(pageTitle?: string | null): string {
  const t = (pageTitle || '').trim()
  if (!t) return SITE.name
  if (t === SITE.name) return t
  return `${t} | ${SITE.name}`
}

// First non-empty candidate wins; the site default guarantees every page
// ships a meta description.
export function buildDescription(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    const v = (c || '').trim()
    if (v) return v
  }
  return SITE.defaultDescription
}

export interface JsonLdInput {
  title: string
  description: string
  canonical: string
  type: 'website' | 'article'
  publishedAt?: string | null
  modifiedAt?: string | null
  authorName?: string | null
  image?: string | null
  crumbs?: Crumb[]
}

// One @graph per page: the site-wide Organization + WebSite nodes, the
// page node (WebPage or Article), and a BreadcrumbList when crumbs exist.
export function buildJsonLd(input: JsonLdInput): Record<string, unknown> {
  const graph: Array<Record<string, unknown>> = [
    {
      '@type': 'Organization',
      '@id': `${SITE.url}/#organization`,
      name: SITE.name,
      url: `${SITE.url}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE.url}/web-app-manifest-512x512.png`,
        width: 512,
        height: 512,
      },
      sameAs: ['https://github.com/metanorma'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE.url}/#website`,
      name: SITE.name,
      url: `${SITE.url}/`,
      description: SITE.defaultDescription,
      publisher: { '@id': `${SITE.url}/#organization` },
      inLanguage: SITE.language,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE.url}/search/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ]

  const page: Record<string, unknown> = {
    '@type': input.type === 'article' ? 'Article' : 'WebPage',
    '@id': `${input.canonical}#page`,
    url: input.canonical,
    name: input.title,
    headline: input.title,
    description: input.description,
    isPartOf: { '@id': `${SITE.url}/#website` },
    inLanguage: SITE.language,
  }
  if (input.image) {
    page.image = new URL(input.image, SITE.url).toString()
  }
  if (input.type === 'article') {
    if (input.publishedAt) page.datePublished = input.publishedAt
    if (input.modifiedAt) page.dateModified = input.modifiedAt
    page.author = input.authorName
      ? { '@type': 'Person', name: input.authorName }
      : { '@id': `${SITE.url}/#organization` }
  }
  graph.push(page)

  if (input.crumbs && input.crumbs.length > 0) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE.url}/`,
        },
        ...input.crumbs.map((crumb, i) => ({
          '@type': 'ListItem',
          position: i + 2,
          name: crumb.label,
          item: new URL(crumb.href, SITE.url).toString(),
        })),
      ],
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}

// Fallback crumbs for pages without a nav tree: derive from the path,
// with the page title as the final (current) crumb.
export function autoCrumbs(pathname: string, pageTitle: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  return segments.map((seg, i) => ({
    label: i === segments.length - 1 && pageTitle ? pageTitle : seg,
    href: '/' + segments.slice(0, i + 1).join('/') + '/',
    isLast: i === segments.length - 1,
  }))
}
