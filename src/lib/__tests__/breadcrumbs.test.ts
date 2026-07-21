import { describe, it, expect } from 'vitest'
import { buildCrumbs } from '../breadcrumbs'
import type { NavRoot } from '../nav-tree'

// Synthetic nav tree — no filesystem involved.
const ISO_TREE: NavRoot = {
  prefix: '/flavors/iso/',
  title: 'ISO',
  items: [
    { title: 'Quick start', file: 'flavors/iso/sample' },
    {
      title: 'Reference guides',
      file: 'flavors/iso/ref',
      items: [
        { title: 'Document attributes', file: 'flavors/iso/ref/document-attributes' },
      ],
    },
  ],
}

describe('buildCrumbs', () => {
  it('returns [] for the home page', () => {
    expect(buildCrumbs(null, '/')).toEqual([])
  })

  it('labels segments from rootLabels and the nav tree', () => {
    const crumbs = buildCrumbs(ISO_TREE, '/flavors/iso/ref/document-attributes/')
    expect(crumbs).toEqual([
      { label: 'Flavors', href: '/flavors/', isLast: false },
      { label: 'ISO', href: '/flavors/iso/', isLast: false },
      { label: 'Reference guides', href: '/flavors/iso/ref/', isLast: false },
      { label: 'Document attributes', href: '/flavors/iso/ref/document-attributes/', isLast: true },
    ])
  })

  it('labels dir-inlined group hubs with the group title', () => {
    const tree: NavRoot = {
      prefix: '/author/',
      title: 'Author',
      items: [
        {
          title: 'Basics',
          items: [{ title: 'What is Metanorma?', file: 'author/basics/what' }],
        },
      ],
    }
    const crumbs = buildCrumbs(tree, '/author/basics/what/')
    expect(crumbs).toEqual([
      { label: 'Author', href: '/author/', isLast: false },
      { label: 'Basics', href: '/author/basics/', isLast: false },
      { label: 'What is Metanorma?', href: '/author/basics/what/', isLast: true },
    ])
  })

  it('falls back to the raw segment when nothing resolves', () => {
    const crumbs = buildCrumbs(null, '/nowhere/special/')
    expect(crumbs).toEqual([
      { label: 'nowhere', href: '/nowhere/', isLast: false },
      { label: 'special', href: '/nowhere/special/', isLast: true },
    ])
  })

  it('uses the nav root title for the root segment', () => {
    const crumbs = buildCrumbs(ISO_TREE, '/flavors/iso/sample/')
    expect(crumbs[1].label).toBe('ISO')
    expect(crumbs[2]).toEqual({ label: 'Quick start', href: '/flavors/iso/sample/', isLast: true })
  })
})
