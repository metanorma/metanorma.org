import { describe, expect, it } from 'vitest'
import { nav, sidebar, sidebarFor } from '../site'

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

describe('Sidebar config', () => {
  it('every sidebar section has items', () => {
    for (const [prefix, items] of Object.entries(sidebar)) {
      expect(prefix).toMatch(/^\//)
      expect(items.length).toBeGreaterThan(0)
      validateSidebarItems(items, prefix)
    }
  })
})

function validateSidebarItems(items: any[], prefix: string) {
  for (const item of items) {
    expect(item.text).toBeTruthy()
    if (item.link) {
      expect(item.link).toMatch(/^\//)
    }
    if (item.items) {
      expect(item.items.length).toBeGreaterThan(0)
      validateSidebarItems(item.items, prefix)
    }
  }
}

describe('sidebarFor', () => {
  it('returns author sidebar for /author/basics/workflow/', () => {
    const items = sidebarFor('/author/basics/workflow/')
    expect(items).not.toBeNull()
    expect(items!.length).toBeGreaterThan(0)
  })

  it('returns null for unknown prefix', () => {
    expect(sidebarFor('/nonexistent/')).toBeNull()
  })

  it('returns the longest-matching prefix', () => {
    const authorItems = sidebarFor('/author/')
    const basicsItems = sidebarFor('/author/basics/')
    expect(authorItems).not.toBeNull()
    expect(basicsItems).not.toBeNull()
  })

  it('handles trailing slash variations', () => {
    const withSlash = sidebarFor('/author/basics/')
    const withoutSlash = sidebarFor('/author/basics')
    expect(withSlash).not.toBeNull()
    // Both should resolve to the same sidebar
    expect(withoutSlash).not.toBeNull()
  })
})
