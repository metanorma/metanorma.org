import type { Flavor } from '../data/types'

// Flavors mega-menu grouping (header nav + mobile menu). A flavor gets a
// header link only when it has docs content — i.e. a mirror collection
// entry with id `flavors/<id>` exists. Nav.astro builds `docsIds` from
// getCollection('mirror') at build time; keeping the grouping pure makes
// the filtering rule unit-testable without Astro's content runtime.

export interface FlavorNavItem {
  label: string
  href: string
  status: Flavor['status']
}

export interface FlavorNavGroup {
  key: Flavor['category']
  label: string
  items: FlavorNavItem[]
}

// Canonical category display order + labels, shared by the header
// mega-menu and the /flavors/ index grid.
export const CATEGORY_ORDER: Array<{ key: Flavor['category']; label: string }> = [
  { key: 'international', label: 'International' },
  { key: 'industry', label: 'Industry' },
  { key: 'national', label: 'National' },
]

export function flavorNavGroups(flavors: Flavor[], docsIds: Set<string>): FlavorNavGroup[] {
  const withDocs = flavors.filter(f => docsIds.has(`flavors/${f.id}`))
  return CATEGORY_ORDER
    .map(c => ({
      ...c,
      items: withDocs
        .filter(f => f.category === c.key)
        .map(f => ({ label: f.label, href: `/flavors/${f.id}/`, status: f.status })),
    }))
    .filter(g => g.items.length > 0)
}
