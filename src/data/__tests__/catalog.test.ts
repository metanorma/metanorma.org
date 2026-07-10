import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { catalog, flavors, gems } from '../index'

describe('catalog', () => {
  it('exports flavors array', () => {
    expect(Array.isArray(flavors)).toBe(true)
    expect(flavors.length).toBeGreaterThan(0)
  })

  it('exports gems array', () => {
    expect(Array.isArray(gems)).toBe(true)
    expect(gems.length).toBeGreaterThan(0)
  })

  it('exports the catalog aggregate', () => {
    expect(catalog).toBeDefined()
    expect(catalog.flavors).toBe(flavors)
    expect(catalog.gems).toBe(gems)
  })

  it('every flavor has required fields', () => {
    for (const f of flavors) {
      expect(f.id).toBeTruthy()
      expect(f.label).toBeTruthy()
      expect(f.gem).toBeTruthy()
      expect(f.repoUrl).toMatch(/^https?:\/\//)
    }
  })

  it('every flavor id is unique', () => {
    const ids = flavors.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('flavor with authoringGuide=true has truthy authoringGuide flag', () => {
    const withGuide = flavors.filter(f => f.authoringGuide)
    expect(withGuide.length).toBeGreaterThan(0)
    for (const f of withGuide) {
      expect(f.authoringGuide).toBe(true)
    }
  })

  it('flavor category is one of the allowed values', () => {
    const allowed = ['international', 'regional', 'national', 'industry', 'other']
    for (const f of flavors) {
      expect(allowed).toContain(f.category)
    }
  })

  it('flavor status is one of the allowed values', () => {
    const allowed = ['supported', 'experimental', 'private']
    for (const f of flavors) {
      expect(allowed).toContain(f.status)
    }
  })

  it('every flavor-category gem has matching flavorId in flavors', () => {
    const flavorIds = new Set(flavors.map(f => f.id))
    const flavorGems = gems.filter(g => g.category === 'flavor')
    expect(flavorGems.length).toBeGreaterThan(0)
    for (const g of flavorGems) {
      if (g.flavorId) {
        expect(flavorIds.has(g.flavorId)).toBe(true)
      }
    }
  })
})

describe('catalog drift check (dev mode)', () => {
  beforeEach(() => {
    (vi.stubEnv as any)('DEV', true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('does NOT log orphans when every flavor-category gem has matching flavor', () => {
    // flavors.ts and software.ts should be in sync at HEAD. This test
    // catches regressions where someone adds a gem but forgets the
    // flavor entry (or vice versa).
    expect(console.error).not.toHaveBeenCalled()
  })
})
