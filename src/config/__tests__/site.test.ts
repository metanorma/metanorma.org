import { describe, expect, it } from 'vitest'
import { nav, sidebarFor } from '../site'

describe('Nav config', () => {
  it('every nav item has text', () => {
    for (const item of nav) {
      expect(item.text).toBeTruthy()
    }
  })

  it('every nav item has either a link or sub-items', () => {
    for (const item of nav) {
      expect(item.link || item.items).toBeTruthy()
      if (item.items) {
        expect(item.items.length).toBeGreaterThan(0)
        for (const sub of item.items) {
          expect(sub.text).toBeTruthy()
          expect(sub.link).toMatch(/^\//)
        }
      }
      if (item.link) {
        expect(item.link).toMatch(/^\//)
      }
    }
  })
})

describe('sidebarFor (declarative _nav.yml)', () => {
  it('returns author nav tree for /author/basics/workflow/', () => {
    const tree = sidebarFor('/author/basics/workflow/')
    expect(tree).not.toBeNull()
    expect(tree!.items.length).toBeGreaterThan(0)
  })

  it('returns null for unknown prefix', () => {
    expect(sidebarFor('/nonexistent/')).toBeNull()
  })

  it('author tree has Basics, Topics, and Editors Guide groups', () => {
    const tree = sidebarFor('/author/')
    expect(tree).not.toBeNull()
    const groupTitles = tree!.items
      .filter(i => !i.file)
      .map(i => i.title)
    expect(groupTitles).toContain('Basics')
    expect(groupTitles).toContain('Topics')
    expect(groupTitles).toContain('Editors Guide')
  })

  it('nav items have descriptions for hover tooltips', () => {
    const tree = sidebarFor('/author/')
    expect(tree).not.toBeNull()
    const withDesc = tree!.items.filter(i => i.description)
    expect(withDesc.length).toBeGreaterThan(0)
  })

  it('handles trailing slash variations', () => {
    const withSlash = sidebarFor('/author/basics/')
    const withoutSlash = sidebarFor('/author/basics')
    expect(withSlash).not.toBeNull()
    expect(withoutSlash).not.toBeNull()
  })
})
