import type { SidebarItem } from './site'

// SidebarRegistry resolves which sidebar items to show for a given
// pathname. Merges hand-authored and auto-generated sidebars, then
// uses longest-prefix matching so the most specific sidebar wins.
//
// Hand-authored entries take precedence on exact-key conflicts.
// Generated entries that are MORE SPECIFIC (longer prefix) than
// hand-authored ones are NOT suppressed — this lets sub-sections
// like /author/ogc/authoring-guide/ show their own generated sidebar
// even though /author/ has a hand-authored one.
export class SidebarRegistry {
  private entries: Record<string, SidebarItem[]> = {}

  constructor(options: {
    generated?: Record<string, SidebarItem[]>
    handAuthored?: Record<string, SidebarItem[]>
  } = {}) {
    this.entries = { ...(options.generated || {}), ...(options.handAuthored || {}) }
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
