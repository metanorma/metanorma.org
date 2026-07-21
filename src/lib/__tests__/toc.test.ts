import { describe, expect, it } from 'vitest'
import { computeTocItems, hasToc, type TocHeading } from '../toc'

const h = (depth: number, text = `heading-${depth}`): TocHeading => ({
  depth,
  slug: text,
  text,
})

describe('computeTocItems', () => {
  it('keeps only headings at depth 2–4', () => {
    const items = computeTocItems([h(1), h(2), h(3), h(4), h(5), h(6)])
    expect(items.map(i => i.depth)).toEqual([2, 3, 4])
  })

  it('preserves document order', () => {
    const items = computeTocItems([h(4, 'c'), h(2, 'a'), h(3, 'b')])
    expect(items.map(i => i.text)).toEqual(['c', 'a', 'b'])
  })

  it('returns [] for no headings', () => {
    expect(computeTocItems([])).toEqual([])
  })
})

describe('hasToc (the shared toc predicate)', () => {
  it('is true with at least 2 eligible headings', () => {
    expect(hasToc([h(2), h(3)])).toBe(true)
    expect(hasToc([h(2), h(4), h(3)])).toBe(true)
  })

  it('is false with fewer than 2 eligible headings', () => {
    expect(hasToc([])).toBe(false)
    expect(hasToc([h(2)])).toBe(false)
  })

  it('ignores headings outside depth 2–4', () => {
    expect(hasToc([h(1), h(5), h(6)])).toBe(false)
    expect(hasToc([h(1), h(2), h(5)])).toBe(false)
  })
})
