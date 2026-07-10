import type { SidebarItem } from './site'

// SidebarRegistry resolves which sidebar items to show for a given
// pathname. Merges hand-authored and auto-generated sidebars.
//
// Rules:
// 1. Hand-authored entries suppress generated entries that are
//    sub-paths of the hand-authored prefix. This ensures the curated
//    /author/ tree shows for ALL /author/* pages (basics, topics,
//    etc.) instead of being overridden by flat generated sub-lists.
// 2. Generated entries for paths NOT covered by any hand-authored
//    prefix are preserved (e.g., /author/ogc/authoring-guide/
//    gets its own generated sidebar since the hand-authored /author/
//    tree doesn't include authoring-guide sub-sections).
// 3. Longest-prefix matching picks the winner among the merged set.
export class SidebarRegistry {
  private entries: Record<string, SidebarItem[]> = {}

  constructor(options: {
    generated?: Record<string, SidebarItem[]>
    handAuthored?: Record<string, SidebarItem[]>
  } = {}) {
    const handAuthored = options.handAuthored || {}
    const generated = options.generated || {}
    const handPrefixes = Object.keys(handAuthored)

    const filtered: Record<string, SidebarItem[]> = {}
    for (const [key, items] of Object.entries(generated)) {
      const covered = handPrefixes.some(prefix => key.startsWith(prefix))
      if (!covered) filtered[key] = items
    }

    this.entries = { ...filtered, ...handAuthored }
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
