import { flavors } from '../data/flavors'

export interface NavigationItem {
  text: string
  link?: string
  items?: NavigationItem[]
}

export const nav: NavigationItem[] = [
  { text: 'Install', link: '/install/' },
  { text: 'Learn', link: '/learn/' },
  {
    text: 'Author',
    items: [
      { text: 'Authoring Guide', link: '/author/' },
      { text: 'Basics', link: '/author/basics/' },
      { text: 'Topics', link: '/author/topics/' },
      { text: 'Editors Guide', link: '/author/editors-guide/' },
    ],
  },
  {
    text: 'Flavors',
    items: [
      { text: 'All Flavors', link: '/flavors/' },
      ...flavors.map(f => ({ text: f.label, link: `/flavors/${f.id}/` })),
    ],
  },
  {
    text: 'Develop',
    items: [
      { text: 'Developer Docs', link: '/develop/' },
      { text: 'Adopting the Spec', link: '/develop/topics/adopting-spec/' },
      { text: 'Creating a Flavor', link: '/develop/topics/adopting-toolchain/' },
    ],
  },
  {
    text: 'Resources',
    items: [
      { text: 'Specs', link: '/specs/' },
      { text: 'Software', link: '/software/' },
      { text: 'Library', link: '/library/' },
      { text: 'Contribute', link: '/contribute/' },
    ],
  },
  { text: 'Blog', link: '/blog/' },
  { text: 'About', link: '/about/' },
]

export type SidebarItem = NavigationItem

// Declarative navigation: _nav.yml files per directory drive the sidebar.
// No auto-generated sidebars. Directory structure IS the tree.
import { resolveNavTree, validateAllNav, type NavRoot } from '../lib/nav-tree'

// Validate nav coverage in dev mode.
if (import.meta.env.DEV) {
  const gaps = validateAllNav()
  if (gaps.length) {
    console.warn('[nav] Pages not declared in _nav.yml:\n' +
      gaps.map(g => `  ${g.section}: ${g.orphans.join(', ')}`).join('\n'))
  }
}

export function sidebarFor(pathname: string): NavRoot | null {
  return resolveNavTree(pathname)
}
