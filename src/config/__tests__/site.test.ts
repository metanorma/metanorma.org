import { describe, expect, it } from 'vitest'
import { nav, footerColumns, sidebarFor } from '../site'

describe('Nav config', () => {
  it('has exactly 5 top-level items in IA order', () => {
    expect(nav.map(i => i.text)).toEqual([
      'Get Started',
      'Docs',
      'Flavors',
      'Developers',
      'Blog',
    ])
  })

  it('top-level items link to their section landings', () => {
    expect(nav.find(i => i.text === 'Get Started')?.link).toBe('/get-started/')
    expect(nav.find(i => i.text === 'Docs')?.link).toBe('/author/')
    expect(nav.find(i => i.text === 'Flavors')?.link).toBe('/flavors/')
    expect(nav.find(i => i.text === 'Developers')?.link).toBe('/develop/')
    expect(nav.find(i => i.text === 'Blog')?.link).toBe('/blog/')
  })

  it('About and Contribute are not in the header nav', () => {
    expect(nav.some(i => i.link === '/about/')).toBe(false)
    expect(nav.some(i => i.link === '/contribute/')).toBe(false)
  })

  it('Get Started dropdown has Quick Start, Installation, Tutorials', () => {
    const item = nav.find(i => i.text === 'Get Started')
    expect(item?.items?.map(s => [s.text, s.link])).toEqual([
      ['Quick Start', '/get-started/'],
      ['Installation', '/install/'],
      ['Tutorials', '/learn/'],
    ])
  })

  it('Docs dropdown includes Reference', () => {
    const item = nav.find(i => i.text === 'Docs')
    const links = item?.items?.map(s => s.link)
    expect(links).toContain('/author/')
    expect(links).toContain('/author/basics/')
    expect(links).toContain('/author/topics/')
    expect(links).toContain('/author/ref/')
    expect(links).toContain('/author/editors-guide/')
  })

  it('Flavors is the mega-menu item with a plain-link fallback', () => {
    const item = nav.find(i => i.text === 'Flavors')
    expect(item?.mega).toBe(true)
    expect(item?.items).toEqual([{ text: 'All Flavors', link: '/flavors/' }])
  })

  it('Developers dropdown includes Specs and Software', () => {
    const item = nav.find(i => i.text === 'Developers')
    const links = item?.items?.map(s => s.link)
    expect(links).toContain('/develop/')
    expect(links).toContain('/develop/topics/adopting-spec/')
    expect(links).toContain('/develop/topics/adopting-toolchain/')
    expect(links).toContain('/specs/')
    expect(links).toContain('/software/')
  })

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

describe('Footer columns', () => {
  it('has Docs, Flavors, Developers, Community columns', () => {
    expect(footerColumns.map(c => c.title)).toEqual([
      'Docs',
      'Flavors',
      'Developers',
      'Community',
    ])
  })

  it('Docs column links to the onboarding pages', () => {
    const docs = footerColumns.find(c => c.title === 'Docs')
    expect(docs?.links.map(l => [l.text, l.link])).toEqual([
      ['Get Started', '/get-started/'],
      ['Installation', '/install/'],
      ['Authoring Guide', '/author/'],
      ['Tutorials', '/learn/'],
    ])
  })

  it('Flavors column has All Flavors plus flagship flavors', () => {
    const flavorsCol = footerColumns.find(c => c.title === 'Flavors')
    const links = flavorsCol?.links.map(l => l.link)
    expect(links).toContain('/flavors/')
    expect(links).toContain('/flavors/iso/')
    expect(links).toContain('/flavors/iec/')
    expect(links).toContain('/flavors/ieee/')
    expect(links).toContain('/flavors/ietf/')
  })

  it('Community column carries About, Contribute and GitHub', () => {
    const community = footerColumns.find(c => c.title === 'Community')
    expect(community?.links.some(l => l.link === '/blog/')).toBe(true)
    expect(community?.links.some(l => l.link === '/about/')).toBe(true)
    expect(community?.links.some(l => l.link === '/contribute/')).toBe(true)
    const github = community?.links.find(l => l.icon === 'github')
    expect(github?.link).toBe('https://github.com/metanorma')
    expect(github?.external).toBe(true)
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
