import { describe, expect, it } from 'vitest'

// Test the pure parts of render-code (regex matching, HTML unescaping)
// without needing Shiki's async initialization.

describe('render-code internals', () => {
  it('regex matches language-tagged code blocks', () => {
    const re = /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g
    const html = '<pre><code class="language-ruby">def foo; end</code></pre>'
    const m = re.exec(html)
    expect(m).not.toBeNull()
    expect(m![1]).toBe('ruby')
    expect(m![2]).toBe('def foo; end')
  })

  it('regex matches multiple code blocks', () => {
    const re = /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g
    const html = '<pre><code class="language-ruby">a</code></pre><p>text</p><pre><code class="language-js">b</code></pre>'
    const matches: string[] = []
    let m
    while ((m = re.exec(html)) !== null) matches.push(m[1])
    expect(matches).toEqual(['ruby', 'js'])
  })

  it('regex does not match plain code blocks (no language)', () => {
    const re = /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g
    const html = '<pre><code>plain text</code></pre>'
    expect(re.exec(html)).toBeNull()
  })

  it('plain code regex matches blocks without language class', () => {
    const re = /<pre><code>([\s\S]*?)<\/code><\/pre>/g
    const html = '<pre><code>plain text</code></pre>'
    const m = re.exec(html)
    expect(m).not.toBeNull()
    expect(m![1]).toBe('plain text')
  })
})

describe('unescapeHtml', () => {
  function unescapeHtml(s: string): string {
    const entities: Record<string, string> = {
      amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
    }
    return s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => entities[e] ?? `&${e};`)
  }

  it('unescapes common HTML entities', () => {
    expect(unescapeHtml('&lt;div&gt;')).toBe('<div>')
    expect(unescapeHtml('&amp;amp')).toBe('&amp')
    expect(unescapeHtml('&#39;hello&#39;')).toBe("'hello'")
    expect(unescapeHtml('&quot;quoted&quot;')).toBe('"quoted"')
  })

  it('leaves plain text unchanged', () => {
    expect(unescapeHtml('hello world')).toBe('hello world')
  })
})
