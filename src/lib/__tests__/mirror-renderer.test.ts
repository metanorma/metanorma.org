import { describe, expect, it } from 'vitest'
import {
  renderMirrorToHtml,
  renderMirrorWithHeadings,
  slugify,
  type MirrorNode,
} from '../mirror-renderer'

function doc(...content: MirrorNode[]): MirrorNode {
  return { type: 'doc', content }
}

function text(t: string, marks: MirrorNode['marks'] = []): MirrorNode {
  return { type: 'text', text: t, marks }
}

function p(...content: MirrorNode[]): MirrorNode {
  return { type: 'paragraph', content }
}

describe('slugify', () => {
  it('lowercases and joins on hyphen', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })
  it('strips non-word chars', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })
  it('collapses repeated hyphens', () => {
    expect(slugify('A   B')).toBe('a-b')
  })
})

describe('renderMirrorToHtml', () => {
  describe('top-level behavior', () => {
    it('returns empty string for unparseable JSON string', () => {
      expect(renderMirrorToHtml('not json {')).toBe('')
    })

    it('accepts a JSON string', () => {
      const json = JSON.stringify(doc(p(text('hello'))))
      expect(renderMirrorToHtml(json)).toBe('<p>hello</p>')
    })

    it('accepts a node object', () => {
      expect(renderMirrorToHtml(doc(p(text('hi'))))).toBe('<p>hi</p>')
    })

    it('returns empty for empty doc', () => {
      expect(renderMirrorToHtml(doc())).toBe('')
    })
  })

  describe('HTML escaping (XSS surface)', () => {
    it('escapes & < > " in text', () => {
      const out = renderMirrorToHtml(p(text('<script>alert("x")</script>')))
      expect(out).toBe(
        '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>',
      )
    })

    it('escapes ampersand first to prevent double-encoding edge cases', () => {
      expect(renderMirrorToHtml(p(text('a & b')))).toBe('<p>a &amp; b</p>')
      expect(renderMirrorToHtml(p(text('a < b > c')))).toBe(
        '<p>a &lt; b &gt; c</p>',
      )
    })

    it('escapes href attribute on links', () => {
      const out = renderMirrorToHtml(
        p(text('x', [{ type: 'link', attrs: { href: '" onmouseover="alert(1)' } }])),
      )
      expect(out).toContain('&quot;')
      expect(out).not.toMatch(/" onmouseover=/)
    })

    it('escapes img src, alt, title, caption', () => {
      const out = renderMirrorToHtml({
        type: 'image',
        attrs: {
          src: 'x" onerror="alert(1)',
          alt: 'alt"x',
          title: 't"x',
          caption: 'cap"x',
        },
      })
      expect(out).toContain('src="x&quot; onerror=&quot;alert(1)"')
      expect(out).toContain('alt="alt&quot;x"')
      expect(out).toContain('title="t&quot;x"')
      expect(out).toContain('<figcaption>cap&quot;x</figcaption>')
    })

    it('escapes id attributes', () => {
      const out = renderMirrorToHtml({
        type: 'heading',
        attrs: { level: 2, id: 'a" onmouseover="evil' },
        content: [text('Hi')],
      })
      expect(out).toContain('id="a&quot; onmouseover=&quot;evil"')
    })

    it('escapes code_block language', () => {
      const out = renderMirrorToHtml({
        type: 'code_block',
        attrs: { lang: 'ruby"><script>' },
        text: 'puts',
      })
      expect(out).toContain('class="language-ruby&quot;&gt;&lt;script&gt;"')
    })

    it('escapes code_block text content', () => {
      const out = renderMirrorToHtml({
        type: 'code_block',
        text: '<script>alert(1)</script>',
      })
      expect(out).toContain('&lt;script&gt;')
      expect(out).not.toContain('<script')
    })

    it('escapes footnote id and ref_id', () => {
      const marker = renderMirrorToHtml({
        type: 'footnote_marker',
        attrs: { id: 'fn"x', ref_id: 'ref"x', number: 1 },
      })
      expect(marker).toContain('href="#fn&quot;x"')
      expect(marker).toContain('id="ref&quot;x"')
    })

    it('escapes link target in xref marks', () => {
      const out = renderMirrorToHtml(
        p(text('see', [{ type: 'xref', attrs: { target: '#a" evil' } }])),
      )
      expect(out).toContain('href="#a&quot; evil"')
    })

    it('escapes role in span marks', () => {
      const out = renderMirrorToHtml(
        p(text('x', [{ type: 'span', attrs: { role: 'a">b' } }])),
      )
      expect(out).toContain('class="a&quot;&gt;b"')
    })

    it('does NOT mark external http URLs as internal', () => {
      const out = renderMirrorToHtml(
        p(text('x', [{ type: 'link', attrs: { href: 'https://evil.example' } }])),
      )
      expect(out).toContain('target="_blank"')
      expect(out).toContain('rel="noopener"')
    })

    it('does NOT add target=_blank for relative URLs', () => {
      const out = renderMirrorToHtml(
        p(text('x', [{ type: 'link', attrs: { href: '/internal/page' } }])),
      )
      expect(out).not.toContain('target=')
    })
  })

  describe('marks', () => {
    const cases: Array<[string, MirrorNode['marks'], string, string]> = [
      ['bold', [{ type: 'bold' }], '<strong>x</strong>', 'wraps in strong'],
      ['italic', [{ type: 'italic' }], '<em>x</em>', 'wraps in em'],
      ['code', [{ type: 'code' }], '<code>x</code>', 'wraps in code'],
      ['underline', [{ type: 'underline' }], '<u>x</u>', 'wraps in u'],
      ['strikethrough', [{ type: 'strikethrough' }], '<s>x</s>', 'wraps in s'],
      ['subscript', [{ type: 'subscript' }], '<sub>x</sub>', 'wraps in sub'],
      ['superscript', [{ type: 'superscript' }], '<sup>x</sup>', 'wraps in sup'],
      ['highlight', [{ type: 'highlight' }], '<mark>x</mark>', 'wraps in mark'],
      ['stem', [{ type: 'stem' }], '<span class="stem">x</span>', 'wraps in stem span'],
      ['span with role', [{ type: 'span', attrs: { role: 'red' } }], '<span class="red">x</span>', 'uses role as class'],
      ['span without role', [{ type: 'span' }], '<span class="">x</span>', 'empty class'],
      ['unknown', [{ type: 'nope' }], '<span>x</span>', 'falls back to span'],
    ]
    for (const [name, marks, expected] of cases) {
      it(`renders ${name} mark`, () => {
        expect(renderMirrorToHtml(p(text('x', marks)))).toBe(`<p>${expected}</p>`)
      })
    }

    it('renders link mark with external href', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'link', attrs: { href: 'https://example.com' } }]))),
      ).toBe('<p><a href="https://example.com" target="_blank" rel="noopener">x</a></p>')
    })

    it('renders link mark with internal href', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'link', attrs: { href: '/page' } }]))),
      ).toBe('<p><a href="/page">x</a></p>')
    })

    it('renders link mark with missing href as #', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'link' }]))),
      ).toBe('<p><a href="#">x</a></p>')
    })

    it('renders xref mark', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'xref', attrs: { target: '#sec1' } }]))),
      ).toBe('<p><a href="#sec1">x</a></p>')
    })

    it('renders bare-ID xref as in-document anchor', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'xref', attrs: { target: 'AnnexA' } }]))),
      ).toBe('<p><a href="#AnnexA">x</a></p>')
    })

    it('renders underscore-prefixed xref as in-document anchor', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'xref', attrs: { target: '_grammatical_information' } }]))),
      ).toBe('<p><a href="#_grammatical_information">x</a></p>')
    })

    it('renders xref with no target as #', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'xref' }]))),
      ).toBe('<p><a href="#">x</a></p>')
    })

    it('preserves cross-document xref target verbatim', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'xref', attrs: { target: 'doc.adoc#anchor' } }]))),
      ).toBe('<p><a href="doc.adoc#anchor">x</a></p>')
    })

    it('preserves URL xref target verbatim', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'xref', attrs: { target: 'https://example.com/page' } }]))),
      ).toBe('<p><a href="https://example.com/page">x</a></p>')
    })

    it('closes marks in reverse order', () => {
      const out = renderMirrorToHtml(
        p(text('x', [{ type: 'bold' }, { type: 'italic' }])),
      )
      expect(out).toBe('<p><strong><em>x</em></strong></p>')
    })

    it('renders text without marks', () => {
      expect(renderMirrorToHtml(p(text('plain')))).toBe('<p>plain</p>')
    })

    it('renders empty text safely', () => {
      expect(renderMirrorToHtml(p(text('')))).toBe('<p></p>')
    })
  })

  describe('block types', () => {
    it('renders heading with explicit level and id', () => {
      expect(
        renderMirrorToHtml({ type: 'heading', attrs: { level: 3, id: 'foo' }, content: [text('Hi')] }),
      ).toBe('<h3 id="foo">Hi</h3>')
    })

    it('slugifies id from text when no explicit id', () => {
      expect(
        renderMirrorToHtml({ type: 'heading', attrs: { level: 2 }, content: [text('Hello World')] }),
      ).toBe('<h2 id="hello-world">Hello World</h2>')
    })

    it('dedupes repeated headings via -N suffix', () => {
      const d = doc(
        { type: 'heading', attrs: { level: 2 }, content: [text('Same Title')] },
        { type: 'heading', attrs: { level: 2 }, content: [text('Same Title')] },
      )
      const out = renderMirrorToHtml(d)
      expect(out).toContain('id="same-title"')
      expect(out).toContain('id="same-title-2"')
    })

    it('defaults heading level to 1', () => {
      expect(
        renderMirrorToHtml({ type: 'heading', content: [text('Hi')] }),
      ).toBe('<h1 id="hi">Hi</h1>')
    })

    it('renders blockquote', () => {
      expect(renderMirrorToHtml({ type: 'blockquote', content: [p(text('q'))] }))
        .toBe('<blockquote><p>q</p></blockquote>')
    })

    it('renders example with default label', () => {
      expect(renderMirrorToHtml({ type: 'example', content: [p(text('x'))] }))
        .toBe('<div class="example-block"><div class="example-label">Example</div><p>x</p></div>')
    })

    it('renders example with custom title', () => {
      expect(
        renderMirrorToHtml({ type: 'example', attrs: { title: 'Sample' }, content: [] }),
      ).toContain('<div class="example-label">Sample</div>')
    })

    it('renders sidebar, open_block, verse', () => {
      expect(renderMirrorToHtml({ type: 'sidebar', content: [] })).toContain('sidebar-block')
      expect(renderMirrorToHtml({ type: 'open_block', content: [] })).toContain('open-block')
      expect(renderMirrorToHtml({ type: 'verse', content: [text('v')] })).toContain('verse-block')
    })

    it('renders bullet and ordered lists', () => {
      const ul = { type: 'bullet_list', content: [{ type: 'list_item', content: [p(text('a'))] }] } as MirrorNode
      const ol = { type: 'ordered_list', content: [{ type: 'list_item', content: [p(text('a'))] }] } as MirrorNode
      expect(renderMirrorToHtml(ul)).toBe('<ul><li><p>a</p></li></ul>')
      expect(renderMirrorToHtml(ol)).toBe('<ol><li><p>a</p></li></ol>')
    })

    it('renders definition lists', () => {
      const dl: MirrorNode = {
        type: 'definition_list',
        content: [
          { type: 'definition_term', content: [text('Term')] },
          { type: 'definition_description', content: [p(text('Desc'))] },
        ],
      }
      expect(renderMirrorToHtml(dl)).toBe('<dl><dt>Term</dt><dd><p>Desc</p></dd></dl>')
    })

    it('renders dl/dt/dd short aliases', () => {
      const dl: MirrorNode = {
        type: 'dl',
        content: [
          { type: 'dt', content: [text('B-series')] },
          { type: 'dd', content: [p(text('Bathymetric Publications'))] },
        ],
      }
      expect(renderMirrorToHtml(dl)).toBe('<dl><dt>B-series</dt><dd><p>Bathymetric Publications</p></dd></dl>')
    })

    it('renders sourcecode from attrs.text', () => {
      const out = renderMirrorToHtml({
        type: 'sourcecode',
        attrs: { language: 'ruby', text: 'puts "hi"' },
      })
      expect(out).toBe('<pre><code class="language-ruby">puts &quot;hi&quot;</code></pre>')
    })

    it('renders sourcecode with title', () => {
      const out = renderMirrorToHtml({
        type: 'sourcecode',
        attrs: { language: 'console', text: '$ cmd', title: 'Running' },
      })
      expect(out).toContain('<div class="code-title">Running</div>')
      expect(out).toContain('<pre><code class="language-console">$ cmd</code></pre>')
    })

    it('renders quote as blockquote', () => {
      const out = renderMirrorToHtml({ type: 'quote', content: [p(text('q'))] })
      expect(out).toBe('<blockquote><p>q</p></blockquote>')
    })

    it('renders clause as section with slugified heading id (level offset by 1)', () => {
      const out = renderMirrorToHtml({
        type: 'clause',
        attrs: { title: 'Concepts', level: 2 },
        content: [p(text('x'))],
      })
      expect(out).toBe('<section id="concepts"><h3 id="concepts">Concepts</h3><p>x</p></section>')
    })

    it('preserves explicit clause id', () => {
      const out = renderMirrorToHtml({
        type: 'clause',
        attrs: { title: 'Concepts', id: '_concepts', level: 2 },
        content: [p(text('x'))],
      })
      expect(out).toBe('<section id="_concepts"><h3 id="_concepts">Concepts</h3><p>x</p></section>')
    })

    it('top-level clause (level 1) renders as h2 — page title takes h1', () => {
      const out = renderMirrorToHtml({
        type: 'clause',
        attrs: { title: 'Top', level: 1 },
        content: [],
      })
      expect(out).toBe('<section id="top"><h2 id="top">Top</h2></section>')
    })

    it('clause level clamps at h6', () => {
      const out = renderMirrorToHtml({
        type: 'clause',
        attrs: { title: 'Deep', level: 6 },
        content: [],
      })
      expect(out).toBe('<section id="deep"><h6 id="deep">Deep</h6></section>')
    })

    it('renders nested clauses with offset levels', () => {
      const out = renderMirrorToHtml({
        type: 'clause',
        attrs: { title: 'A', level: 1 },
        content: [
          { type: 'clause', attrs: { title: 'B', level: 2 }, content: [p(text('x'))] },
        ],
      })
      expect(out).toContain('<h2 id="a">A</h2>')
      expect(out).toContain('<h3 id="b">B</h3>')
      expect(out).toContain('<p>x</p>')
    })

    it('renders annex same as clause', () => {
      const out = renderMirrorToHtml({
        type: 'annex',
        attrs: { title: 'Annex A', level: 1 },
        content: [],
      })
      expect(out).toBe('<section id="annex-a"><h2 id="annex-a">Annex A</h2></section>')
    })

    it('renders sections/preface/generic_block as children only', () => {
      for (const t of ['sections', 'preface', 'generic_block']) {
        expect(renderMirrorToHtml({ type: t as MirrorNode['type'], content: [p(text('x'))] }))
          .toBe('<p>x</p>')
      }
    })

    it('renders table with caption from title', () => {
      const out = renderMirrorToHtml({
        type: 'table',
        attrs: { title: 'My Table' },
        content: [
          { type: 'table_body', content: [{ type: 'table_row', content: [{ type: 'table_cell', content: [text('D')] }] }] },
        ],
      })
      expect(out).toBe('<table><caption>My Table</caption><tbody><tr><td>D</td></tr></tbody></table>')
    })

    it('renders admonition using type attr (coradoc)', () => {
      expect(
        renderMirrorToHtml({ type: 'admonition', attrs: { type: 'warning' }, content: [p(text('w'))] }),
      ).toContain('<div class="admonition-label">Warning</div>')
    })

    it('renders strong mark as <strong>', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'strong' }]))),
      ).toBe('<p><strong>x</strong></p>')
    })

    it('renders emphasis mark as <em>', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'emphasis' }]))),
      ).toBe('<p><em>x</em></p>')
    })

    it('preserves strong + emphasis order', () => {
      expect(
        renderMirrorToHtml(p(text('x', [{ type: 'strong' }, { type: 'emphasis' }]))),
      ).toBe('<p><strong><em>x</em></strong></p>')
    })
  })

  describe('tables', () => {
    it('renders table with head and body', () => {
      const tbl: MirrorNode = {
        type: 'table',
        content: [
          {
            type: 'table_head',
            content: [{
              type: 'table_row',
              content: [{ type: 'table_cell', attrs: { header: true }, content: [text('H')] }],
            }],
          },
          {
            type: 'table_body',
            content: [{
              type: 'table_row',
              content: [{ type: 'table_cell', content: [text('D')] }],
            }],
          },
        ],
      }
      const out = renderMirrorToHtml(tbl)
      expect(out).toBe('<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>')
    })

    it('renders table without head', () => {
      const tbl: MirrorNode = {
        type: 'table',
        content: [
          { type: 'table_body', content: [{ type: 'table_row', content: [] }] },
        ],
      }
      expect(renderMirrorToHtml(tbl)).toBe('<table><tbody><tr></tr></tbody></table>')
    })

    it('renders colspan and rowspan', () => {
      const cell: MirrorNode = {
        type: 'table_cell',
        attrs: { colspan: 2, rowspan: 3 },
        content: [text('x')],
      }
      expect(renderMirrorToHtml(cell))
        .toBe('<td colspan="2" rowspan="3">x</td>')
    })

    it('renders header cell as th', () => {
      expect(
        renderMirrorToHtml({ type: 'table_cell', attrs: { header: true }, content: [text('h')] }),
      ).toBe('<th>h</th>')
    })
  })

  describe('images', () => {
    it('renders image with src and alt only', () => {
      const out = renderMirrorToHtml({ type: 'image', attrs: { src: '/a.png', alt: 'A' } })
      expect(out).toBe('<img src="/a.png" alt="A" loading="lazy" decoding="async" />')
    })

    it('renders image with title and caption', () => {
      const out = renderMirrorToHtml({
        type: 'image',
        attrs: { src: '/a.png', alt: 'A', title: 'T', caption: 'C' },
      })
      expect(out).toContain('title="T"')
      expect(out).toContain('<figcaption>C</figcaption>')
    })

    it('renders image with missing src as empty', () => {
      expect(renderMirrorToHtml({ type: 'image' }))
        .toBe('<img src="" alt="" loading="lazy" decoding="async" />')
    })
  })

  describe('admonitions', () => {
    it('renders admonition with type from admonition_type', () => {
      expect(
        renderMirrorToHtml({ type: 'admonition', attrs: { admonition_type: 'warning' }, content: [] }),
      ).toContain('admonition-warning')
    })

    it('falls back to type attr', () => {
      expect(
        renderMirrorToHtml({ type: 'admonition', attrs: { type: 'tip' }, content: [] }),
      ).toContain('admonition-tip')
    })

    it('defaults to note', () => {
      expect(renderMirrorToHtml({ type: 'admonition', content: [] }))
        .toContain('admonition-note')
    })

    it('capitalizes the label', () => {
      expect(renderMirrorToHtml({ type: 'admonition', attrs: { type: 'note' }, content: [] }))
        .toContain('<div class="admonition-label">Note</div>')
    })
  })

  describe('sections and structural nodes', () => {
    it('renders section with id', () => {
      expect(
        renderMirrorToHtml({ type: 'section', attrs: { id: 's1' }, content: [p(text('x'))] }),
      ).toBe('<section id="s1"><p>x</p></section>')
    })

    it('renders preamble as children only', () => {
      expect(renderMirrorToHtml({ type: 'preamble', content: [p(text('x'))] }))
        .toBe('<p>x</p>')
    })

    it('renders header with explicit level and id', () => {
      expect(
        renderMirrorToHtml({ type: 'header', attrs: { level: 2, id: 'h', title: 'T' } }),
      ).toBe('<h2 id="h">T</h2>')
    })

    it('renders header slugifying from title when no id', () => {
      expect(
        renderMirrorToHtml({ type: 'header', attrs: { title: 'Some Title' } }),
      ).toBe('<h1 id="some-title">Some Title</h1>')
    })

    it('renders bibliography and biblio_entry', () => {
      expect(renderMirrorToHtml({ type: 'bibliography', content: [{ type: 'biblio_entry', content: [] }] }))
        .toBe('<div class="bibliography"><div class="biblio-entry"></div></div>')
    })
  })

  describe('footnotes', () => {
    it('renders footnotes container', () => {
      expect(renderMirrorToHtml({ type: 'footnotes', content: [] }))
        .toBe('<div class="footnotes"></div>')
    })

    it('renders footnote_marker with number and links', () => {
      expect(
        renderMirrorToHtml({ type: 'footnote_marker', attrs: { id: 'fn1', ref_id: 'r1', number: 3 } }),
      ).toBe('<sup class="footnote-marker"><a href="#fn1" id="r1">3</a></sup>')
    })

    it('renders footnote_marker default number as *', () => {
      expect(
        renderMirrorToHtml({ type: 'footnote_marker', attrs: { id: 'x', ref_id: 'y' } }),
      ).toBe('<sup class="footnote-marker"><a href="#x" id="y">*</a></sup>')
    })

    it('renders footnote_entry', () => {
      expect(
        renderMirrorToHtml({ type: 'footnote_entry', attrs: { id: 'fn1', number: 1 }, content: [text('note')] }),
      ).toBe('<div class="footnote-entry" id="fn1"><sup>1</sup> note</div>')
    })
  })

  describe('misc tokens', () => {
    it('renders toc as empty nav', () => {
      expect(renderMirrorToHtml({ type: 'toc' })).toBe('<nav class="toc"></nav>')
    })

    it('renders horizontal_rule', () => {
      expect(renderMirrorToHtml({ type: 'horizontal_rule' })).toBe('<hr>')
    })

    it('renders soft_break', () => {
      expect(renderMirrorToHtml({ type: 'soft_break' })).toBe('<br>')
    })

    it('renders comment as empty string', () => {
      expect(renderMirrorToHtml({ type: 'comment', text: 'hidden' })).toBe('')
    })

    it('renders reviewer', () => {
      expect(renderMirrorToHtml({ type: 'reviewer', content: [p(text('r'))] }))
        .toBe('<div class="reviewer-comment"><p>r</p></div>')
    })

    it('falls back to children for unknown node type', () => {
      expect(renderMirrorToHtml({ type: 'mystery', content: [p(text('x'))] }))
        .toBe('<p>x</p>')
    })

    it('falls back to escaped text for unknown leaf node', () => {
      expect(renderMirrorToHtml({ type: 'mystery', text: '<a>' }))
        .toBe('&lt;a&gt;')
    })
  })

  describe('nested structures', () => {
    it('renders a realistic document', () => {
      const d = doc(
        { type: 'heading', attrs: { level: 1, id: 'top' }, content: [text('Title')] },
        p(text('A paragraph with ')),
        { type: 'bullet_list', content: [
          { type: 'list_item', content: [p(text('one'))] },
          { type: 'list_item', content: [p(text('two'))] },
        ] },
      )
      const out = renderMirrorToHtml(d)
      expect(out).toContain('<h1 id="top">Title</h1>')
      expect(out).toContain('<ul>')
      expect(out).toContain('<li><p>one</p></li>')
    })

    it('preserves order of mixed marks and nodes', () => {
      const d = doc(
        p(
          text('a'),
          text('b', [{ type: 'bold' }]),
          text('c'),
        ),
      )
      expect(renderMirrorToHtml(d)).toBe('<p>a<strong>b</strong>c</p>')
    })
  })

  describe('empty / missing fields', () => {
    it('doc with no content renders empty', () => {
      expect(renderMirrorToHtml({ type: 'doc' })).toBe('')
    })

    it('node with missing attrs is treated as empty attrs', () => {
      expect(renderMirrorToHtml({ type: 'paragraph', content: [text('x')] }))
        .toBe('<p>x</p>')
    })

    it('node with no marks and no text renders empty children', () => {
      expect(renderMirrorToHtml({ type: 'text' })).toBe('')
    })
  })
})

// stripFirstHeadingIf: the renderer-level duplicate-title strip. The
// loader passes the page title; the renderer drops the FIRST recordable
// heading (depth 2–4 with an id) whose text matches it — from BOTH the
// emitted HTML and the headings array, so the two can never disagree
// (the old indexOf/substring loader surgery dropped headings[0] even
// when the HTML strip did not fire).
describe('renderMirrorWithHeadings: stripFirstHeadingIf', () => {
  function clause(title: string, body = 'Body.'): MirrorNode {
    return {
      type: 'clause',
      attrs: { title, level: 1 },
      content: [p(text(body))],
    }
  }

  it('strips the first heading from HTML and headings when it matches the title', () => {
    const { html, headings } = renderMirrorWithHeadings(
      doc(clause('My Page'), clause('Next Section')),
      { stripFirstHeadingIf: 'My Page' },
    )
    expect(html).not.toContain('<h2 id="my-page"')
    expect(html).toContain('Body.')
    expect(html).toContain('<h2 id="next-section">Next Section</h2>')
    expect(headings).toEqual([{ depth: 2, slug: 'next-section', text: 'Next Section' }])
  })

  it('keeps everything when the first heading does not match', () => {
    const { html, headings } = renderMirrorWithHeadings(
      doc(clause('A Section')),
      { stripFirstHeadingIf: 'Other Title' },
    )
    expect(html).toContain('<h2 id="a-section">A Section</h2>')
    expect(headings).toEqual([{ depth: 2, slug: 'a-section', text: 'A Section' }])
  })

  it('only the FIRST recordable heading is a strip candidate', () => {
    // The second heading matches the title but is not stripped.
    const { html, headings } = renderMirrorWithHeadings(
      doc(clause('Intro'), clause('My Page')),
      { stripFirstHeadingIf: 'My Page' },
    )
    expect(html).toContain('<h2 id="intro">Intro</h2>')
    expect(html).toContain('<h2 id="my-page">My Page</h2>')
    expect(headings).toHaveLength(2)
  })

  it('trims the given title before matching', () => {
    const { headings } = renderMirrorWithHeadings(
      doc(clause('My Page')),
      { stripFirstHeadingIf: '  My Page  ' },
    )
    expect(headings).toEqual([])
  })

  it('no option = no stripping', () => {
    const { html, headings } = renderMirrorWithHeadings(doc(clause('My Page')))
    expect(html).toContain('<h2 id="my-page">My Page</h2>')
    expect(headings).toEqual([{ depth: 2, slug: 'my-page', text: 'My Page' }])
  })

  it('strips a matching floating_title as well', () => {
    const d = doc(
      { type: 'floating_title', attrs: { title: 'My Page', level: 1 } },
      p(text('after')),
    )
    const { html, headings } = renderMirrorWithHeadings(d, { stripFirstHeadingIf: 'My Page' })
    expect(html).not.toContain('<h2')
    expect(html).toContain('after')
    expect(headings).toEqual([])
  })
})
