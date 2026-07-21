// Build-time syntax highlighting via Shiki.
//
// Used by mirror-loader to highlight <pre><code class="language-X"> blocks.
// Produces dual-theme output (light + dark) that responds to the .dark class
// on <html>. Zero client-side JS — all highlighting happens at build time.

import { createHighlighter } from 'shiki'
import { unescapeHtml } from './html'

const COMMON_LANGS = [
  'ruby', 'javascript', 'typescript', 'bash', 'shell', 'json', 'yaml',
  'html', 'css', 'xml', 'markdown', 'diff', 'python', 'go', 'sql',
  'adoc', 'dockerfile', 'ini', 'toml',
]

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: COMMON_LANGS,
    })
  }
  return highlighterPromise
}

const CODE_BLOCK_RE = /<pre><code class="language-([^\s">]+)">([\s\S]*?)<\/code><\/pre>/g
const PLAIN_CODE_RE = /<pre><code>([\s\S]*?)<\/code><\/pre>/g

export async function renderCode(html: string): Promise<string> {
  const highlighter = await getHighlighter()

  // Highlight blocks with language class
  let result = html.replace(CODE_BLOCK_RE, (_, lang, code) => {
    const raw = unescapeHtml(code)
    try {
      return highlighter.codeToHtml(raw, {
        lang,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false, // Use CSS variables for dual-theme
      })
    } catch {
      // Unknown language — return original
      return `<pre><code class="language-${lang}">${code}</code></pre>`
    }
  })

  // Highlight plain code blocks (no language specified)
  result = result.replace(PLAIN_CODE_RE, (_, code) => {
    const raw = unescapeHtml(code)
    try {
      return highlighter.codeToHtml(raw, {
        lang: 'text',
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
      })
    } catch {
      return `<pre><code>${code}</code></pre>`
    }
  })

  return result
}
