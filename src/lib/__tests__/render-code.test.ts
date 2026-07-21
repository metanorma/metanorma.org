import { describe, expect, it } from 'vitest'
import { renderCode } from '../render-code'
import { unescapeHtml } from '../html'

// Test the REAL renderCode() with real Shiki (it works in node) and the
// REAL unescapeHtml. Previously this file tested copy-pasted regexes
// and a re-implemented unescapeHtml.

describe('renderCode', () => {
  it('highlights language-class blocks with shiki', async () => {
    const html = '<pre><code class="language-ruby">def foo; end</code></pre>'
    const out = await renderCode(html)
    expect(out).toContain('shiki')
    expect(out).not.toContain('<pre><code class="language-ruby">')
  })

  it('unescapes HTML entities before highlighting', async () => {
    const html = '<pre><code class="language-ruby">puts &quot;hi&quot; &amp; bye</code></pre>'
    const out = await renderCode(html)
    // Shiki re-escapes for output, so the literal source entities must
    // have been decoded first — a raw pass-through would double-escape.
    expect(out).toContain('shiki')
    expect(out).not.toContain('&amp;quot')
  })

  it('highlights plain code blocks (no language) as text', async () => {
    const html = '<pre><code>plain text</code></pre>'
    const out = await renderCode(html)
    expect(out).toContain('shiki')
    expect(out).not.toContain('<pre><code>')
  })

  it('falls back to the original block for unknown languages', async () => {
    const html = '<pre><code class="language-notalang123">some code</code></pre>'
    const out = await renderCode(html)
    expect(out).toBe(html)
  })

  it('handles c++-style language classes (widened lang regex)', async () => {
    // The language regex was widened from \w+ to [^\s">]+ so c++/f#-style
    // classes match at all. Shiki knows c++ as a cpp alias and highlights
    // it even though cpp is not in COMMON_LANGS (it lazy-loads).
    const html = '<pre><code class="language-c++">int main() { return 0; }</code></pre>'
    const out = await renderCode(html)
    expect(out).toContain('shiki')
    expect(out).not.toContain('class="language-c++"')
  })

  it('handles f#-style language classes without corrupting the block', async () => {
    // f# is not a Shiki-known language alias, so the block falls back to
    // its original form — matched by the widened regex, rescued by the
    // unknown-language fallback.
    const html = '<pre><code class="language-f#">let x = 1</code></pre>'
    const out = await renderCode(html)
    expect(out).toBe(html)
  })

  it('highlights multiple blocks in one document', async () => {
    const html = '<pre><code class="language-ruby">a</code></pre><p>text</p><pre><code class="language-yaml">b: c</code></pre>'
    const out = await renderCode(html)
    expect(out).toContain('shiki')
    expect(out).toContain('<p>text</p>')
    // Both blocks were replaced.
    expect(out).not.toContain('class="language-ruby"')
    expect(out).not.toContain('class="language-yaml"')
  })

  it('leaves non-code content untouched', async () => {
    const html = '<p>Hello <code>inline</code> world</p>'
    const out = await renderCode(html)
    expect(out).toBe(html)
  })
})

describe('unescapeHtml', () => {
  it('unescapes common HTML entities', () => {
    expect(unescapeHtml('&lt;div&gt;')).toBe('<div>')
    expect(unescapeHtml('&amp;amp')).toBe('&amp')
    expect(unescapeHtml('&#39;hello&#39;')).toBe("'hello'")
    expect(unescapeHtml('&quot;quoted&quot;')).toBe('"quoted"')
  })

  it('leaves plain text unchanged', () => {
    expect(unescapeHtml('hello world')).toBe('hello world')
  })

  it('leaves unknown entities untouched', () => {
    expect(unescapeHtml('&nbsp;')).toBe('&nbsp;')
    expect(unescapeHtml('&copy;')).toBe('&copy;')
  })

  it('only decodes complete entity references', () => {
    expect(unescapeHtml('&amp')).toBe('&amp')
    expect(unescapeHtml('a & b')).toBe('a & b')
  })
})
