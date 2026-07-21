import { flavors } from '../data/flavors'

export interface NavigationItem {
  text: string
  link?: string
  items?: NavigationItem[]
  // Marks the top-level item whose dropdown Nav.astro renders as a wide
  // mega-menu (currently only Flavors, grouped by category at build time).
  // `items` stays the plain-link fallback for the mobile menu.
  mega?: boolean
}

export const nav: NavigationItem[] = [
  {
    text: 'Get Started',
    link: '/get-started/',
    items: [
      { text: 'Quick Start', link: '/get-started/' },
      { text: 'Installation', link: '/install/' },
      { text: 'Tutorials', link: '/learn/' },
    ],
  },
  {
    text: 'Docs',
    link: '/author/',
    items: [
      { text: 'Authoring Guide', link: '/author/' },
      { text: 'Basics', link: '/author/basics/' },
      { text: 'Topics', link: '/author/topics/' },
      { text: 'Reference', link: '/author/ref/' },
      { text: 'Editors Guide', link: '/author/editors-guide/' },
    ],
  },
  {
    text: 'Flavors',
    link: '/flavors/',
    mega: true,
    items: [{ text: 'All Flavors', link: '/flavors/' }],
  },
  {
    text: 'Developers',
    link: '/develop/',
    items: [
      { text: 'Developer Docs', link: '/develop/' },
      { text: 'Adopting Metanorma', link: '/develop/topics/adopting-spec/' },
      { text: 'Creating a Flavor', link: '/develop/topics/adopting-toolchain/' },
      { text: 'Data Model Specs', link: '/specs/' },
      { text: 'Software Catalog', link: '/software/' },
    ],
  },
  { text: 'Blog', link: '/blog/' },
]

export type SidebarItem = NavigationItem

// Declarative navigation: _nav.yml files per directory drive the sidebar.
// No auto-generated sidebars. Directory structure IS the tree.
import { resolveNavTree, type NavRoot } from '../lib/nav-tree'

export function sidebarFor(pathname: string): NavRoot | null {
  return resolveNavTree(pathname)
}

// ── Footer ───────────────────────────────────────────────────────────
// Footer columns are curated — the header nav no longer maps 1:1 to the
// footer. Flagship flavor links derive from the flavor catalog so their
// labels stay in sync with it.
export interface FooterLink {
  text: string
  link: string
  external?: boolean
  icon?: 'github'
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

const flagship: FooterLink[] = ['iso', 'iec', 'ieee', 'ietf'].map(id => {
  const flavor = flavors.find(f => f.id === id)
  if (!flavor) throw new Error(`footer references unknown flavor: ${id}`)
  return { text: flavor.label, link: `/flavors/${flavor.id}/` }
})

export const footerColumns: FooterColumn[] = [
  {
    title: 'Docs',
    links: [
      { text: 'Get Started', link: '/get-started/' },
      { text: 'Installation', link: '/install/' },
      { text: 'Authoring Guide', link: '/author/' },
      { text: 'Tutorials', link: '/learn/' },
    ],
  },
  {
    title: 'Flavors',
    links: [{ text: 'All Flavors', link: '/flavors/' }, ...flagship],
  },
  {
    title: 'Developers',
    links: [
      { text: 'Developer Docs', link: '/develop/' },
      { text: 'Data Model Specs', link: '/specs/' },
      { text: 'Software Catalog', link: '/software/' },
    ],
  },
  {
    title: 'Community',
    links: [
      { text: 'Blog', link: '/blog/' },
      { text: 'About', link: '/about/' },
      { text: 'Contribute', link: '/contribute/' },
      { text: 'GitHub', link: 'https://github.com/metanorma', external: true, icon: 'github' },
    ],
  },
]
