import { describe, expect, it } from 'vitest'
import { flattenNavFiles, prevNextForPath } from '../prev-next'
import { getNavTrees, type NavNode, type NavRoot } from '../nav-tree'

// flattenNavFiles / prevNextForPath are pure; the synthetic trees below
// exercise the ordering rules without the repo, and one test pins the
// real learn/_nav.yml reading sequence (the PrevNext use case).

function node(title: string, file?: string, items?: NavNode[]): NavNode {
  return { title, file, items }
}

describe('flattenNavFiles', () => {
  it('flattens depth-first in declared order, group landing file first', () => {
    const items: NavNode[] = [
      node('Intro', 'learn/index'),
      node('Lesson 1', 'learn/lessons/lesson-1', [
        node('Part A', 'learn/lessons/lesson-1-1'),
        node('Part B', 'learn/lessons/lesson-1-2', [
          node('Deep', 'learn/lessons/lesson-1-2-1'),
        ]),
      ]),
      node('Exercises', 'learn/exercises'),
    ]
    expect(flattenNavFiles(items).map(f => f.file)).toEqual([
      'learn/index',
      'learn/lessons/lesson-1',
      'learn/lessons/lesson-1-1',
      'learn/lessons/lesson-1-2',
      'learn/lessons/lesson-1-2-1',
      'learn/exercises',
    ])
  })

  it('skips nodes without a file but still descends into their items', () => {
    const items: NavNode[] = [
      node('Group', undefined, [node('Child', 'a/child')]),
      node('Bare', 'a/bare'),
    ]
    expect(flattenNavFiles(items).map(f => f.file)).toEqual(['a/child', 'a/bare'])
  })

  it('returns an empty sequence for empty items', () => {
    expect(flattenNavFiles([])).toEqual([])
  })
})

describe('prevNextForPath', () => {
  const nav: NavRoot = {
    prefix: '/docs/',
    title: 'Docs',
    items: [
      node('One', 'docs/page-one'),
      node('Two', 'docs/page-two'),
      node('Three', 'docs/page-three'),
    ],
  }

  it('returns both neighbours for a middle page', () => {
    expect(prevNextForPath(nav, '/docs/page-two/')).toEqual({
      prev: { title: 'One', href: '/docs/page-one/' },
      next: { title: 'Three', href: '/docs/page-three/' },
    })
  })

  it('normalizes a missing trailing slash', () => {
    expect(prevNextForPath(nav, '/docs/page-two').next?.href).toBe('/docs/page-three/')
  })

  it('has no prev at the sequence start and no next at the end', () => {
    const first = prevNextForPath(nav, '/docs/page-one/')
    const last = prevNextForPath(nav, '/docs/page-three/')
    expect(first.prev).toBeUndefined()
    expect(first.next?.href).toBe('/docs/page-two/')
    expect(last.prev?.href).toBe('/docs/page-two/')
    expect(last.next).toBeUndefined()
  })

  it('returns an empty result for a path outside the sequence', () => {
    expect(prevNextForPath(nav, '/docs/elsewhere/')).toEqual({})
  })
})

describe('prevNextForPath against the real learn nav', () => {
  it('paginates lesson 2 along the learn/_nav.yml course sequence', () => {
    const learnRoot = getNavTrees().find(t => t.prefix === '/learn/')
    expect(learnRoot).toBeDefined()
    const { prev, next } = prevNextForPath(learnRoot!, '/learn/lessons/lesson-2/')
    expect(prev?.href).toBe('/learn/lessons/lesson-1-3/')
    expect(next?.href).toBe('/learn/lessons/lesson-2-1/')
  })
})
