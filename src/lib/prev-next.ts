// Prev/next pagination over a nav tree.
//
// The reading sequence of a section is the depth-first flattening of its
// nav tree's `file:` entries, in declared order (group nodes contribute
// their own landing file first, then their children). Pure functions —
// the Astro component (src/components/PrevNext.astro) is a thin shell.

import { sourcePathToUrl, type NavNode, type NavRoot } from './nav-tree'

export interface FlatNavEntry {
  title: string
  file: string
}

export interface PrevNextLink {
  title: string
  href: string
}

export interface PrevNext {
  prev?: PrevNextLink
  next?: PrevNextLink
}

// Linear flatten of nav items: file entries, depth-first, declared order.
export function flattenNavFiles(items: NavNode[]): FlatNavEntry[] {
  const out: FlatNavEntry[] = []
  for (const item of items) {
    if (item.file) out.push({ title: item.title, file: item.file })
    if (item.items) out.push(...flattenNavFiles(item.items))
  }
  return out
}

// Prev/next neighbours of `pathname` in the tree's reading sequence.
// Both are undefined when the path is not part of the sequence (the
// component renders nothing in that case).
export function prevNextForPath(nav: NavRoot, pathname: string): PrevNext {
  const flat = flattenNavFiles(nav.items)
  const normalized = '/' + pathname.replace(/^\/+|\/+$/g, '') + '/'
  const index = flat.findIndex(f => sourcePathToUrl(f.file) === normalized)
  if (index === -1) return {}
  const toLink = (entry: FlatNavEntry): PrevNextLink => ({
    title: entry.title,
    href: sourcePathToUrl(entry.file),
  })
  return {
    prev: index > 0 ? toLink(flat[index - 1]) : undefined,
    next: index < flat.length - 1 ? toLink(flat[index + 1]) : undefined,
  }
}
