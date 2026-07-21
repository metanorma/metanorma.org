import { describe, expect, it } from 'vitest'
import { rewriteFlavorLinks } from '../rewrite-flavor-links'
import { flavors } from '../../data/flavors'

// The rewriter is driven by the real flavors catalog ids; pick a few
// known-stable ones for the cases.
const KNOWN_IDS = ['iso', 'ieee', 'ogc']

describe('rewriteFlavorLinks', () => {
  it('catalog sanity: the ids used below really are flavors', () => {
    const ids = flavors.map(f => f.id)
    for (const id of KNOWN_IDS) expect(ids).toContain(id)
  })

  it('rewrites /author/{flavor}/ to /flavors/{flavor}/', () => {
    for (const id of KNOWN_IDS) {
      expect(rewriteFlavorLinks(`<a href="/author/${id}/">x</a>`))
        .toBe(`<a href="/flavors/${id}/">x</a>`)
    }
  })

  it('rewrites flavor subpaths', () => {
    expect(rewriteFlavorLinks('<a href="/author/iso/topics/blocks/">x</a>'))
      .toBe('<a href="/flavors/iso/topics/blocks/">x</a>')
    expect(rewriteFlavorLinks('<a href="/author/iso/ref/document-attributes/">x</a>'))
      .toBe('<a href="/flavors/iso/ref/document-attributes/">x</a>')
  })

  it('rewrites a bare flavor root without a trailing slash', () => {
    expect(rewriteFlavorLinks('<a href="/author/iso">x</a>'))
      .toBe('<a href="/flavors/iso">x</a>')
  })

  it('rewrites every occurrence in the document', () => {
    expect(rewriteFlavorLinks('<a href="/author/iso/">a</a><a href="/author/iec/ref/">b</a>'))
      .toBe('<a href="/flavors/iso/">a</a><a href="/flavors/iec/ref/">b</a>')
  })

  it('leaves non-flavor /author/ paths untouched', () => {
    expect(rewriteFlavorLinks('<a href="/author/basics/">x</a>')).toBe('<a href="/author/basics/">x</a>')
    expect(rewriteFlavorLinks('<a href="/author/topics/inline-markup/">x</a>'))
      .toBe('<a href="/author/topics/inline-markup/">x</a>')
  })

  it('leaves unknown flavor-like ids untouched', () => {
    expect(rewriteFlavorLinks('<a href="/author/notaflavor/">x</a>'))
      .toBe('<a href="/author/notaflavor/">x</a>')
  })

  it('does not rewrite when the flavor id is only a path prefix', () => {
    // "iso" followed by more non-slash characters is not the iso flavor.
    expect(rewriteFlavorLinks('<a href="/author/isorello/">x</a>'))
      .toBe('<a href="/author/isorello/">x</a>')
    expect(rewriteFlavorLinks('<a href="/author/iso-extra/deep/">x</a>'))
      .toBe('<a href="/author/iso-extra/deep/">x</a>')
  })

  it('only touches href attributes, not link text', () => {
    expect(rewriteFlavorLinks('<p>/author/iso/ is documented</p>'))
      .toBe('<p>/author/iso/ is documented</p>')
  })
})
