import { describe, expect, it } from 'vitest'
import { normalizeLinks } from '../normalize-links'

describe('normalizeLinks', () => {
  describe('trailing-slash insertion', () => {
    it('adds a trailing slash to root-relative paths', () => {
      expect(normalizeLinks('<a href="/path">x</a>')).toBe('<a href="/path/">x</a>')
      expect(normalizeLinks('<a href="/a/b/c">x</a>')).toBe('<a href="/a/b/c/">x</a>')
    })

    it('leaves paths that already end with a slash', () => {
      expect(normalizeLinks('<a href="/path/">x</a>')).toBe('<a href="/path/">x</a>')
    })

    it('leaves the root path alone', () => {
      expect(normalizeLinks('<a href="/">x</a>')).toBe('<a href="/">x</a>')
    })

    it('does not touch fragment-only or query URLs', () => {
      expect(normalizeLinks('<a href="/#frag">x</a>')).toBe('<a href="/#frag">x</a>')
      expect(normalizeLinks('<a href="/p?query=1">x</a>')).toBe('<a href="/p?query=1">x</a>')
      expect(normalizeLinks('<a href="/p#frag">x</a>')).toBe('<a href="/p#frag">x</a>')
    })

    it('does not touch external URLs', () => {
      expect(normalizeLinks('<a href="https://example.com/p">x</a>'))
        .toBe('<a href="https://example.com/p">x</a>')
    })

    it('does not touch relative (non-root) hrefs', () => {
      expect(normalizeLinks('<a href="page">x</a>')).toBe('<a href="page">x</a>')
    })

    it('handles multiple links in one document', () => {
      expect(normalizeLinks('<a href="/a">1</a><a href="/b/">2</a>'))
        .toBe('<a href="/a/">1</a><a href="/b/">2</a>')
    })
  })

  describe('placeholder URL cleanup', () => {
    it('replaces empty hrefs with #', () => {
      expect(normalizeLinks('<a href="">x</a>')).toBe('<a href="#">x</a>')
      expect(normalizeLinks('<a href=" ">x</a>')).toBe('<a href="#">x</a>')
    })

    it('replaces bare-scheme placeholder hrefs with #', () => {
      expect(normalizeLinks('<a href="https://">x</a>')).toBe('<a href="#">x</a>')
      expect(normalizeLinks('<a href="http:">x</a>')).toBe('<a href="#">x</a>')
    })

    it('replaces the literal placeholder href="href"', () => {
      expect(normalizeLinks('<a href="href">x</a>')).toBe('<a href="#">x</a>')
    })
  })
})
