import { describe, expect, it } from 'vitest'

// The Astro config's sitemap filter excludes redirect source URLs.
// This spec verifies the filter logic in isolation (the actual filter
// runs at config time; we replicate the predicate here for testing).

const redirectSourceSet = new Set([
  '/reference_docs/',
  '/author/mpfa/',
  '/flavors/pdf-association/',
  '/software/metanorma-mpfa/',
  '/reference_docs',
  '/author/mpfa',
  '/flavors/pdf-association',
  '/software/metanorma-mpfa',
])

function sitemapFilter(page: string): boolean {
  const path = new URL(page).pathname
  return !redirectSourceSet.has(path) && !redirectSourceSet.has(path.replace(/\/$/, ''))
}

describe('astro.config sitemap filter', () => {
  it('excludes redirect source URLs (with trailing slash)', () => {
    expect(sitemapFilter('https://www.metanorma.org/reference_docs/')).toBe(false)
    expect(sitemapFilter('https://www.metanorma.org/author/mpfa/')).toBe(false)
    expect(sitemapFilter('https://www.metanorma.org/flavors/pdf-association/')).toBe(false)
  })

  it('excludes redirect source URLs (without trailing slash)', () => {
    expect(sitemapFilter('https://www.metanorma.org/reference_docs')).toBe(false)
    expect(sitemapFilter('https://www.metanorma.org/author/mpfa')).toBe(false)
  })

  it('includes canonical URLs', () => {
    expect(sitemapFilter('https://www.metanorma.org/author/basics/workflow/')).toBe(true)
    expect(sitemapFilter('https://www.metanorma.org/')).toBe(true)
    expect(sitemapFilter('https://www.metanorma.org/flavors/pdfa/')).toBe(true)
  })

  it('handles paths with query/hash by URL-parsing first', () => {
    expect(sitemapFilter('https://www.metanorma.org/reference_docs/?foo=bar')).toBe(false)
    expect(sitemapFilter('https://www.metanorma.org/author/mpfa/#section')).toBe(false)
  })
})
