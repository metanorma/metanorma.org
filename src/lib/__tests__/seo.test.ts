import { describe, it, expect } from 'vitest'
import { SITE, buildTitle, buildDescription, buildJsonLd, autoCrumbs } from '../seo'

describe('buildTitle', () => {
  it('returns the site name when no page title', () => {
    expect(buildTitle()).toBe('Metanorma')
    expect(buildTitle('')).toBe('Metanorma')
    expect(buildTitle('   ')).toBe('Metanorma')
  })
  it('suffixes page titles with the site name', () => {
    expect(buildTitle('Blog')).toBe('Blog | Metanorma')
  })
  it('does not double the site name', () => {
    expect(buildTitle('Metanorma')).toBe('Metanorma')
  })
})

describe('buildDescription', () => {
  it('picks the first non-empty candidate', () => {
    expect(buildDescription('a', 'b')).toBe('a')
    expect(buildDescription('', 'b')).toBe('b')
    expect(buildDescription(null, undefined, 'c')).toBe('c')
  })
  it('falls back to the site default', () => {
    expect(buildDescription()).toBe(SITE.defaultDescription)
    expect(buildDescription('', null)).toBe(SITE.defaultDescription)
  })
})

describe('buildJsonLd', () => {
  const base = {
    title: 'Some page',
    description: 'A description',
    canonical: 'https://www.metanorma.org/author/basics/',
    type: 'website' as const,
  }

  it('always includes Organization and WebSite nodes', () => {
    const ld = buildJsonLd(base) as any
    const types = ld['@graph'].map((n: any) => n['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
    expect(types).toContain('WebPage')
    expect(ld['@context']).toBe('https://schema.org')
    const org = ld['@graph'].find((n: any) => n['@type'] === 'Organization')
    expect(org.sameAs).toContain('https://github.com/metanorma')
    const page = ld['@graph'].find((n: any) => n['@type'] === 'WebPage')
    expect(page.url).toBe(base.canonical)
    expect(page.isPartOf['@id']).toBe(`${SITE.url}/#website`)
  })

  it('emits Article with date + author for article pages', () => {
    const ld = buildJsonLd({
      ...base,
      type: 'article',
      publishedAt: '2024-01-02',
      authorName: 'Jane Doe',
    }) as any
    const article = ld['@graph'].find((n: any) => n['@type'] === 'Article')
    expect(article.datePublished).toBe('2024-01-02')
    expect(article.author).toEqual({ '@type': 'Person', name: 'Jane Doe' })
  })

  it('emits Article with headline, image, dateModified when supplied', () => {
    const ld = buildJsonLd({
      ...base,
      type: 'article',
      publishedAt: '2024-01-02',
      modifiedAt: '2024-06-01',
      authorName: 'Jane Doe',
      image: '/assets/og/x.png',
    }) as any
    const article = ld['@graph'].find((n: any) => n['@type'] === 'Article')
    expect(article.headline).toBe('Some page')
    expect(article.dateModified).toBe('2024-06-01')
    expect(article.image).toBe('https://www.metanorma.org/assets/og/x.png')
  })

  it('omits dateModified when not supplied', () => {
    const ld = buildJsonLd({ ...base, type: 'article', publishedAt: '2024-01-02' }) as any
    const article = ld['@graph'].find((n: any) => n['@type'] === 'Article')
    expect(article.dateModified).toBeUndefined()
  })

  it('falls back to the organization as article author', () => {
    const ld = buildJsonLd({ ...base, type: 'article', publishedAt: '2024-01-02' }) as any
    const article = ld['@graph'].find((n: any) => n['@type'] === 'Article')
    expect(article.author['@id']).toBe(`${SITE.url}/#organization`)
  })

  it('serializes crumbs into a BreadcrumbList rooted at Home', () => {
    const ld = buildJsonLd({
      ...base,
      crumbs: [
        { label: 'Author', href: '/author/', isLast: false },
        { label: 'Basics', href: '/author/basics/', isLast: true },
      ],
    }) as any
    const bc = ld['@graph'].find((n: any) => n['@type'] === 'BreadcrumbList')
    expect(bc.itemListElement).toHaveLength(3)
    expect(bc.itemListElement[0]).toMatchObject({ position: 1, name: 'Home', item: `${SITE.url}/` })
    expect(bc.itemListElement[2]).toMatchObject({
      position: 3,
      name: 'Basics',
      item: `${SITE.url}/author/basics/`,
    })
  })

  it('omits BreadcrumbList when there are no crumbs', () => {
    const ld = buildJsonLd(base) as any
    expect(ld['@graph'].some((n: any) => n['@type'] === 'BreadcrumbList')).toBe(false)
  })
})

describe('autoCrumbs', () => {
  it('builds path crumbs with the page title last', () => {
    expect(autoCrumbs('/flavors/iso/', 'ISO')).toEqual([
      { label: 'flavors', href: '/flavors/', isLast: false },
      { label: 'ISO', href: '/flavors/iso/', isLast: true },
    ])
  })
  it('returns an empty array at the root', () => {
    expect(autoCrumbs('/', 'Home')).toEqual([])
  })
})
