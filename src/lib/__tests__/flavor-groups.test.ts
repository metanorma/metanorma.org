import { describe, expect, it } from 'vitest'
import { flavors } from '../../data/flavors'
import { flavorNavGroups } from '../flavor-groups'

// Flavors without docs content in the mirror collection — they must never
// appear in the header mega-menu (see Nav.astro, which builds docsIds
// from getCollection('mirror')).
const DOCS_LESS = ['icc', 'elf', 'enosema', 'swf', 'mbxif', 'pdfa']

const docsIds = new Set(
  flavors.filter(f => !DOCS_LESS.includes(f.id)).map(f => `flavors/${f.id}`),
)

describe('flavorNavGroups', () => {
  const groups = flavorNavGroups(flavors, docsIds)

  it('groups by category in International, Industry, National order', () => {
    expect(groups.map(g => g.label)).toEqual(['International', 'Industry', 'National'])
  })

  it('excludes flavors without docs entries', () => {
    const hrefs = groups.flatMap(g => g.items.map(i => i.href))
    for (const id of DOCS_LESS) {
      expect(hrefs).not.toContain(`/flavors/${id}/`)
    }
  })

  it('includes documented flavors under the right category', () => {
    const byLabel = Object.fromEntries(groups.map(g => [g.label, g.items.map(i => i.href)]))
    expect(byLabel['International']).toContain('/flavors/iso/')
    expect(byLabel['International']).toContain('/flavors/ietf/')
    expect(byLabel['Industry']).toContain('/flavors/cc/')
    expect(byLabel['National']).toContain('/flavors/jis/')
  })

  it('carries status through for the menu chips', () => {
    const all = groups.flatMap(g => g.items)
    expect(all.find(i => i.href === '/flavors/m3aawg/')?.status).toBe('experimental')
    expect(all.find(i => i.href === '/flavors/nist/')?.status).toBe('private')
    expect(all.find(i => i.href === '/flavors/iso/')?.status).toBe('supported')
  })

  it('returns no groups when nothing has docs', () => {
    expect(flavorNavGroups(flavors, new Set())).toEqual([])
  })
})
