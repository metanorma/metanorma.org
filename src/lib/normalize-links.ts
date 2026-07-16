// Normalizes internal links to always end with a trailing slash.
// The site uses trailingSlash: 'always', so /path must become /path/.
// Also fixes broken placeholder URLs from AsciiDoc documentation examples.
export function normalizeLinks(html: string): string {
  return html
    .replace(/href="(\/[^"#?]*[^"#?/])"/g, 'href="$1/"')
    .replace(/href="https?:\/\/"/g, 'href="#"')
    .replace(/href="https?:"/g, 'href="#"')
    .replace(/href="href"/g, 'href="#"')
}
