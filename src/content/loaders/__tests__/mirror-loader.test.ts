import { describe, expect, it } from 'vitest'
import { renderMirrorToHtml } from '../../../lib/mirror-renderer'

describe('mirror-loader headings extraction', () => {
  // The loader uses the same renderMirrorToHtml to produce HTML, then
  // regex-extracts headings. Verify the renderer emits <h2 id="..."> etc.
  // so the loader's extraction works end-to-end.

  it('renders h2 with id for clause', () => {
    const html = renderMirrorToHtml({
      type: 'doc',
      content: [
        { type: 'clause', attrs: { title: 'Section', level: 1 }, content: [] },
      ],
    })
    expect(html).toMatch(/<h2 id="section">Section<\/h2>/)
  })

  it('renders nested h3 for sub-clause', () => {
    const html = renderMirrorToHtml({
      type: 'doc',
      content: [
        {
          type: 'clause',
          attrs: { title: 'Top', level: 1 },
          content: [
            { type: 'clause', attrs: { title: 'Sub', level: 2 }, content: [] },
          ],
        },
      ],
    })
    expect(html).toMatch(/<h2 id="top">Top<\/h2>/)
    expect(html).toMatch(/<h3 id="sub">Sub<\/h3>/)
  })

  it('excludes h1 from TOC-eligible headings', () => {
    // h1 is the page title (Article.astro emits it). TOC.astro filters
    // to depth 2-4, so h1 doesn't appear in the right-side TOC.
    const html = renderMirrorToHtml({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'body' }] }],
    })
    expect(html).not.toMatch(/<h1 /)
  })
})

describe('mirror-loader regex (extractHeadings)', () => {
  // The loader's extractHeadings regex parses renderer output. Verify
  // it catches realistic patterns including attributes on <hN>.

  it('matches <h2 id="slug">text</h2>', () => {
    const html = '<h2 id="my-section">My Section</h2>'
    const matches = [...html.matchAll(/<h([234])\s+id="([^"]+)"[^>]*>(.*?)<\/h\1>/g)]
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('2')
    expect(matches[0][2]).toBe('my-section')
    expect(matches[0][3]).toBe('My Section')
  })

  it('matches <h3> with extra attributes', () => {
    const html = '<h3 id="x" class="foo">Text</h3>'
    const matches = [...html.matchAll(/<h([234])\s+id="([^"]+)"[^>]*>(.*?)<\/h\1>/g)]
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('3')
  })

  it('captures heading text including inner tags', () => {
    const html = '<h2 id="x">Hello <code>World</code></h2>'
    const matches = [...html.matchAll(/<h([234])\s+id="([^"]+)"[^>]*>(.*?)<\/h\1>/g)]
    const raw = matches[0][3]
    expect(raw).toContain('Hello')
    expect(raw).toContain('World')
  })

  it('does not match h5 or h6 (excluded from TOC)', () => {
    const html = '<h5 id="deep">Deep</h5><h6 id="deeper">Deeper</h6>'
    const matches = [...html.matchAll(/<h([234])\s+id="([^"]+)"[^>]*>(.*?)<\/h\1>/g)]
    expect(matches).toHaveLength(0)
  })
})
