import { describe, expect, it } from 'vitest'
import { makeSitemapFilter } from '../config/redirects-from-content.mjs'

// The Astro config's sitemap filter excludes redirect source URLs so
// only canonical targets get indexed. This spec exercises the REAL
// makeSitemapFilter used by astro.config.mjs's sitemap integration
// (previously the predicate was re-implemented inline in this file).

// Mirror the set-building from astro.config.mjs: every redirect source
// is registered both with and without a trailing slash.
function sourceSet(redirects: Record<string, string>): Set<string> {
  return new Set(Object.keys(redirects).flatMap(url => [url, url.replace(/\/$/, '')]))
}

const filter = makeSitemapFilter(sourceSet({
  '/reference_docs/': '/author/ref/',
  '/author/mpfa/': '/author/',
  '/flavors/pdf-association/': '/flavors/pdfa/',
  '/software/metanorma-mpfa/': '/software/',
}))

describe('makeSitemapFilter (astro.config sitemap filter)', () => {
  it('excludes redirect source URLs (with trailing slash)', () => {
    expect(filter('https://www.metanorma.org/reference_docs/')).toBe(false)
    expect(filter('https://www.metanorma.org/author/mpfa/')).toBe(false)
    expect(filter('https://www.metanorma.org/flavors/pdf-association/')).toBe(false)
  })

  it('excludes redirect source URLs (without trailing slash)', () => {
    expect(filter('https://www.metanorma.org/reference_docs')).toBe(false)
    expect(filter('https://www.metanorma.org/author/mpfa')).toBe(false)
  })

  it('includes canonical URLs', () => {
    expect(filter('https://www.metanorma.org/author/basics/workflow/')).toBe(true)
    expect(filter('https://www.metanorma.org/')).toBe(true)
    expect(filter('https://www.metanorma.org/flavors/pdfa/')).toBe(true)
  })

  it('handles paths with query/hash by URL-parsing first', () => {
    expect(filter('https://www.metanorma.org/reference_docs/?foo=bar')).toBe(false)
    expect(filter('https://www.metanorma.org/author/mpfa/#section')).toBe(false)
  })

  it('does not over-exclude paths that merely share a prefix', () => {
    expect(filter('https://www.metanorma.org/reference_docs/extra/')).toBe(true)
    expect(filter('https://www.metanorma.org/author/mpfa-deep-dive/')).toBe(true)
  })
})
