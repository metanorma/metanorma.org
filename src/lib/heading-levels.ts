// Heading level semantics for HTML rendering.
//
// In AsciiDoc, document sections have levels relative to the document title
// (level 0). When rendered as an HTML page where the document title is the
// single <h1>, a section at level N becomes <h(N+1)>. HTML caps at <h6>.
//
// `heading` and `header` block types (rare/never emitted by coradoc today)
// use absolute levels and bypass this helper.

export const MAX_HEADING_LEVEL = 6

export function sectionLevelToHeadingLevel(level: number | undefined): number {
  const safe = level && level > 0 ? level : 1
  return Math.min(safe + 1, MAX_HEADING_LEVEL)
}
