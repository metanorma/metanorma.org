import { describe, expect, it } from 'vitest'
import { renderDescription, renderInline } from '../attr-description'

describe('renderInline', () => {
  it('escapes HTML before formatting', () => {
    expect(renderInline('a <b> & "c"')).toBe('a &lt;b&gt; &amp; &quot;c&quot;')
  })

  it('renders `code` spans', () => {
    expect(renderInline('use `:docnumber:` here')).toBe('use <code>:docnumber:</code> here')
  })

  it('renders *bold* and _italic_ with word boundaries', () => {
    expect(renderInline('the *approval group* is _necessary_')).toBe(
      'the <strong>approval group</strong> is <em>necessary</em>')
  })

  it('does not italicize underscores inside words/attribute names', () => {
    expect(renderInline('use :publisher_2: or publisher_3: here')).toBe(
      'use :publisher_2: or publisher_3: here')
  })

  it('renders "`smart quotes`" before code spans', () => {
    expect(renderInline('a "`part-subpart`" value')).toBe('a &ldquo;part-subpart&rdquo; value')
  })

  it('renders link:url[text] with absolute targets untouched', () => {
    expect(renderInline('see link:/author/topics/languages[Languages] topic')).toBe(
      'see <a href="/author/topics/languages">Languages</a> topic')
  })

  it('resolves relative link: targets to the sibling page', () => {
    expect(renderInline('link:document-attributes-v2[are given separately]')).toBe(
      '<a href="../document-attributes-v2/">are given separately</a>')
  })

  it('renders bare https://url[text] macros', () => {
    expect(renderInline('per https://www.iso.org/stage-codes.html[stage codes]')).toBe(
      'per <a href="https://www.iso.org/stage-codes.html" target="_blank" rel="noopener">stage codes</a>')
  })

  it('renders <<anchor,text>> cross-references as fragment links', () => {
    expect(renderInline('see <<distribution-group,Distribution group>>.')).toBe(
      'see <a href="#distribution-group">Distribution group</a>.')
  })

  it('renders [added in URL] as a compact release link', () => {
    const url = 'https://github.com/metanorma/metanorma-standoc/releases/tag/v2.7.0'
    expect(renderInline(`multiple values [added in ${url}].`)).toBe(
      `multiple values <a class="added-in" href="${url}" target="_blank" rel="noopener">added in v2.7.0</a>.`)
  })

  it('does not format inside code spans', () => {
    expect(renderInline('`*not bold* and _not italic_`')).toBe(
      '<code>*not bold* and _not italic_</code>')
  })
})

describe('renderDescription — blocks', () => {
  it('keeps multi-paragraph structure', () => {
    const html = renderDescription('First paragraph\nwrapped line.\n\nSecond paragraph.')
    expect(html).toBe('<p>First paragraph wrapped line.</p><p>Second paragraph.</p>')
  })

  it('strips AsciiDoc hard-break markers ( +) at line ends', () => {
    const html = renderDescription('The ISO document number without any part. +\nNext line.')
    expect(html).toBe('<p>The ISO document number without any part. Next line.</p>')
  })

  it('renders bullet lists, including ** nesting', () => {
    const html = renderDescription('* one\n* two\n** nested a\n** nested b\n* three')
    expect(html).toBe(
      '<ul><li>one</li><li>two<ul><li>nested a</li><li>nested b</li></ul></li><li>three</li></ul>')
  })

  it('renders [source] ---- fences as code blocks without inline formatting', () => {
    const src = 'Example:\n\n[source,adoc]\n----\n:publisher: `not code` *not bold*\n----'
    const html = renderDescription(src)
    expect(html).toBe(
      '<p>Example:</p><div class="code-block" data-code-block><pre><code>' +
      ':publisher: `not code` *not bold*</code></pre></div>')
  })

  it('escapes HTML inside code fences', () => {
    const html = renderDescription('----\n<street>57 Mt Pleasant St</street>\n----')
    expect(html).toContain('&lt;street&gt;57 Mt Pleasant St&lt;/street&gt;')
  })

  it('renders fenced [NOTE] admonitions with the site classes', () => {
    const html = renderDescription('[NOTE]\n====\nBody text with `code`.\n====')
    expect(html).toBe(
      '<div class="admonition admonition-note" data-admonition="note">' +
      '<div class="admonition-header"><span class="admonition-label">Note</span></div>' +
      '<div class="admonition-body"><p>Body text with <code>code</code>.</p></div></div>')
  })

  it('renders paragraph-style [NOTE] (no fence) wrapping the next paragraph', () => {
    const html = renderDescription('Before.\n\n[NOTE]\nNoted paragraph.\n\nAfter.')
    expect(html).toBe(
      '<p>Before.</p>' +
      '<div class="admonition admonition-note" data-admonition="note">' +
      '<div class="admonition-header"><span class="admonition-label">Note</span></div>' +
      '<div class="admonition-body"><p>Noted paragraph.</p></div></div>' +
      '<p>After.</p>')
  })

  it('renders [TIP] admonitions with their own kind class', () => {
    const html = renderDescription('[TIP]\n====\nTip body.\n====')
    expect(html).toContain('admonition-tip')
    expect(html).toContain('<span class="admonition-label">Tip</span>')
  })

  it('renders [example] ==== blocks', () => {
    const html = renderDescription('[example]\n====\n:publisher_2:\n====')
    expect(html).toBe(
      '<div class="example-block"><div class="example-label">Example</div>' +
      '<div class="code-block" data-code-block><pre><code>:publisher_2:</code></pre></div></div>')
  })

  it('renders .Title caption lines', () => {
    const html = renderDescription('.Example of a thing\n:publisher: X')
    expect(html).toBe(
      '<div class="block-title">Example of a thing</div>' +
      '<div class="code-block" data-code-block><pre><code>:publisher: X</code></pre></div>')
  })

  it('renders [[anchor]] lines as id spans (deep-link parity)', () => {
    const html = renderDescription('[[note_general_doc_ref_doc_attrib]]\n[NOTE]\n====\nBody.\n====')
    expect(html.startsWith('<span id="note_general_doc_ref_doc_attrib"></span>')).toBe(true)
    expect(html).toContain('admonition-note')
  })

  it('renders runs of :attr: value lines as code blocks', () => {
    const html = renderDescription(':relaton-data-source-bib1: PATH/TO/FIRST/FILE\n:relaton-data-source-bib2: PATH/TO/SECOND/FILE')
    expect(html).toBe(
      '<div class="code-block" data-code-block><pre><code>' +
      ':relaton-data-source-bib1: PATH/TO/FIRST/FILE\n:relaton-data-source-bib2: PATH/TO/SECOND/FILE' +
      '</code></pre></div>')
  })

  it('formats value descriptions with bullets and inline markup (ietf shape)', () => {
    const html = renderDescription(
      'sets the document as an Internet-Draft (default value):\n' +
      '** `rfc/front/seriesInfo@name` attribute will be set to _Internet-Draft_\n' +
      '** `rfc@docName` will be set to the `:docnumber:` attribute')
    expect(html).toBe(
      '<p>sets the document as an Internet-Draft (default value):</p>' +
      '<ul><li><code>rfc/front/seriesInfo@name</code> attribute will be set to <em>Internet-Draft</em></li>' +
      '<li><code>rfc@docName</code> will be set to the <code>:docnumber:</code> attribute</li></ul>')
  })
})
