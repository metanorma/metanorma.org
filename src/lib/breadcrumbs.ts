// Breadcrumb model — single source for both the on-page Breadcrumb
// component and the SEO BreadcrumbList JSON-LD.
//
// The nav tree comes from the page (resolved once per pathname). Every
// crumb segment of a real page lives under that same tree — top-level
// segments fall back to rootLabels.

import { rootLabels } from '../config/labels'
import { sourcePathToUrl } from './nav-tree'
import type { NavRoot, NavNode } from './nav-tree'

export interface Crumb {
  label: string
  href: string
  isLast: boolean
}

function norm(url: string): string {
  return '/' + url.replace(/^\/+|\/+$/g, '') + '/'
}

function findLabel(items: NavNode[], target: string): string | null {
  const targetNorm = norm(target)
  // 1. Exact page match.
  for (const item of items) {
    if (item.file && norm(sourcePathToUrl(item.file)) === targetNorm) {
      return item.title
    }
  }
  // 2. Deeper match inside a group.
  for (const item of items) {
    if (item.items) {
      const sub = findLabel(item.items, target)
      if (sub) return sub
    }
  }
  // 3. Group hub: dir-inlined groups have no file of their own — if the
  // target is the prefix of the group's children, the group labels it.
  for (const item of items) {
    if (item.items?.some(child =>
      child.file && norm(sourcePathToUrl(child.file)).startsWith(targetNorm),
    )) {
      return item.title
    }
  }
  return null
}

function resolveLabel(nav: NavRoot | null, cumulative: string, segment: string): string {
  if (rootLabels[segment]) return rootLabels[segment]
  if (!nav) return segment
  const navPath = nav.prefix.replace(/\/+$/g, '')
  if (cumulative === navPath) return nav.title
  return findLabel(nav.items, cumulative) ?? segment
}

export function buildCrumbs(nav: NavRoot | null, pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []
  let cumulative = ''
  for (let i = 0; i < segments.length; i++) {
    cumulative += '/' + segments[i]
    const label = resolveLabel(nav, cumulative, segments[i])
    crumbs.push({ label, href: cumulative + '/', isLast: i === segments.length - 1 })
  }
  return crumbs
}
