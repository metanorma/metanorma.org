// Normalizes internal links to always end with a trailing slash.
// The site uses trailingSlash: 'always', so /path must become /path/.
// Catches links in raw HTML blocks that the AST-level rewriter misses.
export function normalizeLinks(html: string): string {
  return html.replace(/href="(\/[^"#?]*[^"#?/])"/g, 'href="$1/"')
}
