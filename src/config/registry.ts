import type { SidebarItem } from './site'

// SidebarRegistry resolves which sidebar items to show for a given
// pathname. It merges hand-authored and auto-generated sidebars with
// a precedence rule: hand-authored entries win on exact-key conflicts,
// AND generated entries that are sub-paths of a hand-authored prefix
// are suppressed so the curated sidebar shows for every page in that
// section.
export class SidebarRegistry {
  private entries: Record<string, SidebarItem[]> = {}

  constructor(options: {
    generated?: Record<string, SidebarItem[]>
    handAuthored?: Record<string, SidebarItem[]>
  } = {}) {
    const suppressed = this.suppressCoveredGenerated(
      options.generated || {},
      options.handAuthored || {},
    )
    this.entries = { ...suppressed, ...(options.handAuthored || {}) }
  }

  // Suppress generated entries whose prefix is a sub-path of any
  // hand-authored prefix. Without this, longest-prefix matching on
  // /author/basics/ would pick the generated sidebar (flat page-title
  // list) over the hand-authored /author/ sidebar (curated groups).
  private suppressCoveredGenerated(
    generated: Record<string, SidebarItem[]>,
    handAuthored: Record<string, SidebarItem[]>,
  ): Record<string, SidebarItem[]> {
    const handAuthoredPrefixes = Object.keys(handAuthored)
    const out: Record<string, SidebarItem[]> = {}
    for (const [key, items] of Object.entries(generated)) {
      const covered = handAuthoredPrefixes.some(prefix => key.startsWith(prefix))
      if (!covered) out[key] = items
    }
    return out
  }

  resolve(pathname: string): SidebarItem[] | null {
    const normalized = pathname.replace(/\/$/, '') + '/'
    const matched = Object.keys(this.entries)
      .filter(prefix => normalized.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0]
    return matched ? this.entries[matched] : null
  }

  prefixes(): string[] {
    return Object.keys(this.entries).sort()
  }
}
