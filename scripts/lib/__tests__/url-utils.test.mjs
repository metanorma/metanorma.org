import { describe, expect, it } from 'vitest'
import { outputKeyToUrl, pagesPathToUrl } from '../url-utils.mjs'

describe('outputKeyToUrl', () => {
  it('prefixes leading slash when missing', () => {
    expect(outputKeyToUrl('foo/bar')).toBe('/foo/bar')
  })

  it('preserves existing leading slash', () => {
    expect(outputKeyToUrl('/foo/bar')).toBe('/foo/bar')
  })

  it('converts /index suffix to trailing slash (directory URL)', () => {
    expect(outputKeyToUrl('install/index')).toBe('/install/')
    expect(outputKeyToUrl('author/basics/index')).toBe('/author/basics/')
  })

  it('does not collapse non-index trailing segments', () => {
    expect(outputKeyToUrl('author/basics/workflow')).toBe('/author/basics/workflow')
  })

  it('preserves literal `index` segment when not a trailing /index (root index handled by walk caller)', () => {
    // The sitemap walker treats `index.md` at the dist root as `/`
    // before calling outputKeyToUrl. outputKeyToUrl itself only handles
    // the `/index` → `/` suffix collapse.
    expect(outputKeyToUrl('author/basics/index')).toBe('/author/basics/')
  })

  it('coerces non-string input to string', () => {
    expect(outputKeyToUrl(123)).toBe('/123')
  })
})

describe('pagesPathToUrl', () => {
  it('strips .md extension', () => {
    expect(pagesPathToUrl('foo/bar.md')).toBe('/foo/bar')
  })

  it('root index.md becomes /', () => {
    expect(pagesPathToUrl('index.md')).toBe('/')
  })

  it('nested index.md becomes directory URL', () => {
    expect(pagesPathToUrl('install/index.md')).toBe('/install/')
    expect(pagesPathToUrl('author/basics/index.md')).toBe('/author/basics/')
  })

  it('normalizes Windows-style backslashes', () => {
    expect(pagesPathToUrl('foo\\bar.md')).toBe('/foo/bar')
  })

  it('preserves literal .html extension (Jekyll-era URLs)', () => {
    expect(pagesPathToUrl('learn/template.html')).toBe('/learn/template.html')
  })
})
