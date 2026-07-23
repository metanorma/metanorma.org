import { describe, it, expect } from 'vitest'
import { wrap, buildSvg, escapeXml } from '../build-og-images.mjs'

describe('escapeXml', () => {
  it('escapes the five XML metacharacters', () => {
    expect(escapeXml(`a & b < c > d " e ' f`))
      .toBe('a &amp; b &lt; c &gt; d &quot; e &apos; f')
  })
  it('does not modify plain text', () => {
    expect(escapeXml('Metanorma wins Stevie Awards')).toBe('Metanorma wins Stevie Awards')
  })
})

describe('wrap', () => {
  it('returns one line for a short title', () => {
    expect(wrap('Hello world')).toEqual(['Hello world'])
  })

  it('returns an empty array for an empty title', () => {
    expect(wrap('')).toEqual([])
  })

  it('wraps a long title at word boundaries', () => {
    const out = wrap('Metanorma wins two Gold Stevie Awards at 2018 International Business Awards')
    expect(out.length).toBeLessThanOrEqual(3)
    // Every line within the limit (last line may carry the ellipsis char).
    for (const line of out) {
      expect(line.length).toBeLessThanOrEqual(38)
    }
    // No word should be split mid-character.
    expect(out.join(' ')).toMatch(/Metanorma/)
  })

  it('respects a custom maxCharsPerLine', () => {
    const out = wrap('one two three four five six seven eight', 12, 5)
    for (const line of out) {
      expect(line.length).toBeLessThanOrEqual(12)
    }
  })

  it('caps output at maxLines', () => {
    const long = 'word '.repeat(50).trim()
    expect(wrap(long).length).toBe(3)
  })

  it('appends an ellipsis on the last line when truncating', () => {
    const long = 'word '.repeat(50).trim()
    const out = wrap(long)
    expect(out[out.length - 1]).toMatch(/…$/)
  })

  it('handles single-word titles longer than the line', () => {
    // A single very long word can't be wrapped; falls through to one line.
    const out = wrap('supercalifragilisticexpialidocious-and-then-some-more')
    expect(out.length).toBe(1)
  })

  it('does not collapse when every word fits exactly', () => {
    const out = wrap('a '.repeat(38).trim(), 38, 3)
    // We asked for 38-char lines; the title is 76 chars (38 'a' words
    // separated by spaces). Should wrap into ≤3 lines without losing data.
    expect(out.length).toBeLessThanOrEqual(3)
  })
})

describe('buildSvg', () => {
  it('emits an SVG with the right viewBox and dimensions', () => {
    const svg = buildSvg({ title: 'Hello', date: '2025-01-01', author: 'Jane', slug: 'x' })
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="1200"')
    expect(svg).toContain('height="630"')
    expect(svg).toContain('viewBox="0 0 1200 630"')
  })

  it('escapes ampersands in the title', () => {
    const svg = buildSvg({ title: 'A & B', date: '', author: '', slug: 'x' })
    expect(svg).toContain('A &amp; B')
    expect(svg).not.toContain('A & B')
  })

  it('escapes ampersands in the byline (date · author)', () => {
    const svg = buildSvg({ title: 'T', date: '2025-01-01', author: 'Tom & Jerry', slug: 'x' })
    expect(svg).toContain('Tom &amp; Jerry')
  })

  it('omits the byline text when neither date nor author are set', () => {
    const svg = buildSvg({ title: 'No byline', date: '', author: '', slug: 'x' })
    // The byline <text> is only emitted when byline is non-empty.
    expect(svg).not.toMatch(/y="540"[^>]*>\s*<\/text>/)
  })

  it('renders one <text> element per wrapped title line', () => {
    const svg = buildSvg({
      title: 'Metanorma wins two Gold Stevie Awards at 2018 International Business Awards',
      date: '', author: '', slug: 'x',
    })
    // Count font-size="56" text nodes (only the title uses 56).
    const matches = svg.match(/font-size="56"/g)
    expect(matches?.length).toBeGreaterThanOrEqual(2)
    expect(matches?.length).toBeLessThanOrEqual(3)
  })

  it('includes the brand gradient + tagline markers', () => {
    const svg = buildSvg({ title: 'X', date: '', author: '', slug: 'x' })
    expect(svg).toContain('linearGradient')
    expect(svg).toContain('Metanorma')
    expect(svg).toContain('Standards beyond words')
  })
})
