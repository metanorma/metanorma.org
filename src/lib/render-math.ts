// Build-time math rendering via KaTeX.
//
// Used by mirror-loader to convert stem/math blocks to rendered HTML
// at content-load time. Eliminates ~250 KB of client-side KaTeX JS.
//
// Dispatches on stem block language (data-language attribute) so
// future math syntaxes can be added without touching the loader:
//   - latex / latexmath → KaTeX (LaTeX math)
//   - asciimath         → escaped passthrough (AsciiMath converter TBD)
//   - mathml            → preserved verbatim (already rendered XML)
//   - (default)         → verbatim passthrough
//
// Two inline math syntaxes also supported in any text:
//   - $...$ and \\(...\\) → inline
//   - $$...$$ and \\[...\\] → display

import katex from 'katex'
import { escapeHtml } from './html'

const INLINE_MATH = /\$([^\$\n]+)\$|\\\(([^)]+)\\\)/g
const DISPLAY_MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g
const STEM_BLOCK = /<div class="math math-([a-z]+)"[^>]*>([\s\S]*?)<\/div>/g

const STEM_RENDERERS: Record<string, (input: string) => string> = {
  latex: (latex) => renderKatex(latex, false),
  latexmath: (latex) => renderKatex(latex, false),
  asciimath: (ascii) => `<span class="math-asciimath">${escapeHtml(ascii)}</span>`,
  mathml: (xml) => xml,
}

export function renderMath(html: string): string {
  return html
    .replace(STEM_BLOCK, (_, lang, body) => {
      const renderer = STEM_RENDERERS[lang]
      return renderer ? renderer(body.trim()) : body
    })
    .replace(DISPLAY_MATH, (_, a, b) => renderKatex(a || b, true))
    .replace(INLINE_MATH, (_, a, b) => renderKatex(a || b, false))
}

function renderKatex(latex: string, displayMode: boolean): string {
  const expr = latex.trim()
  if (!expr) return ''
  try {
    return katex.renderToString(expr, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
    })
  } catch {
    return latex
  }
}
