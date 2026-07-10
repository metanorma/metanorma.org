import { load } from 'js-yaml'

export interface ParsedDocument {
  frontmatter: Record<string, any>
  body: string
}

// Matches a leading `---\n...\n---` block. The inner `\r?\n?` is optional
// so empty frontmatter blocks (`---\n---`) also match. `\r?\n` everywhere
// supports Windows-style CRLF source files.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n?---\r?\n?/

export function parseFrontmatter(raw: string): ParsedDocument {
  const m = raw.match(FRONTMATTER_RE)
  if (!m) return { frontmatter: {}, body: raw }
  try {
    return { frontmatter: (load(m[1]) as Record<string, any>) || {}, body: raw.slice(m[0].length) }
  } catch {
    return { frontmatter: {}, body: raw.slice(m[0].length) }
  }
}
