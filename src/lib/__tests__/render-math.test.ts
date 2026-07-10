import { describe, expect, it } from 'vitest'
import { renderMath } from '../render-math'

describe('renderMath — KaTeX language dispatch', () => {
  it('renders LaTeX stem block via dispatcher', () => {
    const out = renderMath('<div class="math math-latex" data-language="latex">E = mc^2</div>')
    expect(out).toContain('katex')
    expect(out).toContain('<math')
  })

  it('renders latexmath stem block (alias for latex)', () => {
    const out = renderMath('<div class="math math-latexmath">x^2</div>')
    expect(out).toContain('katex')
  })

  it('passes MathML stem block through verbatim', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>'
    const out = renderMath(`<div class="math math-mathml">${mathml}</div>`)
    expect(out).toContain('<math')
    expect(out).toContain('<mi>x</mi>')
  })

  it('renders AsciiMath stem block with escaped passthrough', () => {
    const out = renderMath('<div class="math math-asciimath">sum_(i=1)^n i</div>')
    expect(out).toContain('math-asciimath')
    expect(out).toContain('sum_(i=1)^n i')
  })

  it('falls back to verbatim for unknown stem language', () => {
    const out = renderMath('<div class="math math-unknownlang">foo bar</div>')
    expect(out).toContain('foo bar')
    expect(out).not.toContain('katex')
  })
})

describe('renderMath — inline math', () => {
  it('renders inline math via $...$', () => {
    const out = renderMath('The formula is $x^2 + y^2 = r^2$ here.')
    expect(out).toContain('katex')
    expect(out).not.toContain('$x^2')
  })

  it('renders inline math via \\(...\\)', () => {
    const out = renderMath('Formula: \\(a + b\\) end.')
    expect(out).toContain('katex')
  })

  it('renders display math via $$...$$', () => {
    const out = renderMath('Block:\n$$\\int_0^1 x \\, dx$$\nend.')
    expect(out).toContain('katex-display')
  })

  it('renders display math via \\[...\\]', () => {
    const out = renderMath('Block:\\[\\sum_{i=1}^n i\\]end.')
    expect(out).toContain('katex-display')
  })

  it('renders stem block (LaTeX)', () => {
    const out = renderMath('<div class="math math-latex" data-language="latex">E = mc^2</div>')
    expect(out).toContain('katex')
  })
})

describe('renderMath — edge cases', () => {
  it('preserves non-math HTML unchanged', () => {
    const input = '<p>Hello world.</p><code>foo</code>'
    expect(renderMath(input)).toBe(input)
  })

  it('returns source verbatim on invalid math (no throw)', () => {
    expect(() => renderMath('$\\undefined_symbol_xyz$')).not.toThrow()
  })

  it('handles empty input', () => {
    expect(renderMath('')).toBe('')
  })

  it('handles multiple math expressions in one HTML string', () => {
    const out = renderMath('$a$ and $b$ plus $$c + d$$')
    const matches = out.match(/katex/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(3)
  })

  it('escapes HTML in AsciiMath passthrough', () => {
    const out = renderMath('<div class="math math-asciimath">a < b > c</div>')
    expect(out).toContain('&lt;')
    expect(out).toContain('&gt;')
  })

  it('uses strict: ignore to suppress Unicode warnings', () => {
    const out = renderMath("$'curly' quotes$")
    expect(out).toContain('katex')
  })
})
