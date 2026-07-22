// Version chips for `[added in …]` / `[deprecated in …]` mentions.
//
// Single source for the chip markup used by BOTH render paths:
//   - attr-description.ts (YAML attribute-reference pages, inline macros)
//   - render-pipeline.ts (mirror pages, as a post-render HTML step)
//
// The canonical macro links to a GitHub release:
//   https://github.com/metanorma/<component>/releases/tag/<version>
// and renders as a linked chip `<component> ≥ <version>` — the same
// markup AttrEntry.astro uses for entry-level added_in chips.

export type VersionChipKind = 'added' | 'deprecated'

// Parse a release URL into a chip, or null when it is not a
// metanorma GitHub release link (callers fall back to a plain link).
export function versionChip(url: string, kind: VersionChipKind): string | null {
  const m = url.match(/github\.com\/metanorma\/([^/]+)\/releases\/tag\/([^/?\]]+)/)
  if (!m) return null
  const [, component, version] = m
  const cls = kind === 'added' ? 'attr-chip attr-chip-version' : 'attr-chip attr-chip-warn'
  const label = kind === 'added' ? 'Added' : 'Deprecated'
  const text = kind === 'added'
    ? `${component} ≥ ${version}`
    : `${label.toLowerCase()} in ${component} ≥ ${version}`
  return `<a class="${cls}" href="${url}" target="_blank" rel="noopener" title="${label} in ${component} ${version}">${text}</a>`
}

// Post-render HTML step: the mirror renderer autolinks URLs, leaving
// `[added in <a href="URL"…>…</a>]` in the output. Convert those (and
// the deprecated-in form) to version chips.
export function chipifyVersionMentions(html: string): string {
  return html
    .replace(/\[added in <a href="([^"]+)"[^>]*>[^<]*<\/a>\]/g, (_, url) => {
      const chip = versionChip(url, 'added')
      return chip ?? `<a class="added-in" href="${url}" target="_blank" rel="noopener">added in ${url.split('/').pop()}</a>`
    })
    .replace(/\[deprecated in <a href="([^"]+)"[^>]*>[^<]*<\/a>\]/g, (_, url) => {
      const chip = versionChip(url, 'deprecated')
      return chip ?? `<a class="added-in" href="${url}" target="_blank" rel="noopener">deprecated in ${url.split('/').pop()}</a>`
    })
}
