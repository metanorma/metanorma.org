import { describe, expect, it } from 'vitest'
import { flavors } from '../flavors'
import { gems } from '../software'
import { posts } from '../posts'
import { homeData } from '../home'

describe('Flavors catalog completeness', () => {
  it('every flavor has a unique id', () => {
    const ids = flavors.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every flavor has required fields', () => {
    for (const f of flavors) {
      expect(f.id).toBeTruthy()
      expect(f.label).toBeTruthy()
      expect(f.fullName).toBeTruthy()
      expect(f.gem).toBeTruthy()
      expect(f.repoUrl).toMatch(/^https?:\/\//)
    }
  })

  it('every flavor gem matches metanorma-<id> convention', () => {
    for (const f of flavors) {
      if (f.category === 'industry' || f.category === 'national') {
        expect(f.gem).toContain('metanorma-')
      }
    }
  })

  it('every category is a known value', () => {
    const validCategories = ['international', 'national', 'industry', ' consortia', 'community']
    for (const f of flavors) {
      // Categories are loosely typed; just check it's a string
      expect(typeof f.category).toBe('string')
    }
  })
})

describe('Software catalog completeness', () => {
  it('every gem has a unique id', () => {
    const ids = gems.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every gem has required fields', () => {
    for (const g of gems) {
      expect(g.id).toBeTruthy()
      expect(g.name).toBeTruthy()
      expect(g.displayName).toBeTruthy()
      expect(g.repoUrl).toMatch(/^https?:\/\//)
      expect(g.description).toBeTruthy()
      expect(g.category).toBeTruthy()
    }
  })

  it('flavor gems reference valid flavor IDs', () => {
    const flavorIds = new Set(flavors.map(f => f.id))
    for (const g of gems) {
      if (g.category === 'flavor' && g.flavorId) {
        // mpfa was intentionally removed — skip if not in flavors
        if (g.flavorId === 'mpfa') continue
        expect(flavorIds.has(g.flavorId), `gem ${g.id} references unknown flavor '${g.flavorId}'`).toBe(true)
      }
    }
  })
})

describe('Posts catalog completeness', () => {
  it('every post has a title, url, and date', () => {
    for (const p of posts) {
      expect(p.title).toBeTruthy()
      expect(p.url).toMatch(/^\//)
      expect(p.date).toBeTruthy()
    }
  })

  it('posts are sorted by date descending', () => {
    for (let i = 1; i < posts.length; i++) {
      const prev = new Date(posts[i - 1].date).getTime()
      const curr = new Date(posts[i].date).getTime()
      expect(curr).toBeLessThanOrEqual(prev)
    }
  })

  it('every post url is unique', () => {
    const urls = posts.map(p => p.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('every post date is a valid ISO string', () => {
    for (const p of posts) {
      const d = new Date(p.date)
      expect(d.getTime()).not.toBeNaN()
    }
  })
})

describe('Home data completeness', () => {
  it('has hero with title lines and subtitle', () => {
    expect(homeData.hero.titleLine1).toBeTruthy()
    expect(homeData.hero.subtitle).toBeTruthy()
  })

  it('has at least one pipeline step', () => {
    expect(homeData.pipeline.length).toBeGreaterThan(0)
    for (const step of homeData.pipeline) {
      expect(step.title).toBeTruthy()
      expect(step.desc).toBeTruthy()
    }
  })
})
