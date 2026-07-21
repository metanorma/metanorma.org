// Declarative navigation tree reader.
//
// Content sections are defined in src/config/sections.yml (the single
// section registry, shared with the Ruby converter). Sections with
// nav_root: true are the sidebar roots: each directory with a _nav.yml
// gets a sidebar.
// URLs are source file paths translated through the section registry:
// a section whose source_dir differs from its output_prefix (install:
// _pages/install → /install/) has its nav prefixes and file URLs mapped
// to output space, with every segment kebabed like the converter's
// output mapping. Tree sections (source_dir == output_prefix) are
// identity-mapped, so `file:` entries are plain source paths.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'

export interface NavNode {
  title: string
  file?: string
  description?: string
  items?: NavNode[]
  dir?: string
}

export interface NavRoot {
  prefix: string
  title: string
  items: NavNode[]
}

const SOURCE_ROOT = process.cwd()

// Sidebar roots: sections with nav_root: true in src/config/sections.yml.
interface SectionEntry {
  id: string
  source_dir: string
  output_prefix: string
  nav_root?: boolean
  mapping: string
}

// Read lazily (like the tree build below) — importing this module must
// not touch the filesystem.
let sectionsCache: SectionEntry[] | null = null
function getSections(): SectionEntry[] {
  if (sectionsCache) return sectionsCache
  const config = load(readFileSync(join(SOURCE_ROOT, 'src/config/sections.yml'), 'utf-8')) as { sections: SectionEntry[] }
  sectionsCache = config.sections
  return sectionsCache
}

function getContentRoots(): SectionEntry[] {
  return getSections().filter(s => s.nav_root)
}

const SKIP_DIRS = new Set(['node_modules', '_upstream', 'dist', '.astro',
  '.git', 'SUPERSEDED', 'scripts', 'src', 'public', 'mirror-json',
  '.github', '.playwright-mcp', '.jekyll-cache'])

function kebabSegment(segment: string): string {
  return segment.replace(/_/g, '-')
}

// URL prefix for a nav directory inside a section: the section's
// output_prefix plus the directory's path relative to the section's
// source_dir, kebabed (the converter kebabs every output segment).
function dirToPrefix(section: SectionEntry, dir: string): string {
  const rel = dir === section.source_dir ? '' : dir.slice(section.source_dir.length + 1)
  const relKebab = rel.split('/').map(kebabSegment).join('/')
  return '/' + [section.output_prefix, relKebab].filter(Boolean).join('/') + '/'
}

function readNavYml(dir: string): NavNode | null {
  const navPath = join(SOURCE_ROOT, dir, '_nav.yml')
  if (!existsSync(navPath)) return null
  try {
    return load(readFileSync(navPath, 'utf-8')) as NavNode
  } catch {
    return null
  }
}

// Superseded source files (removed from the site but kept on disk per
// the never-delete-source rule) are filtered by the converter at
// collection time — Convert::PathMapping::SUPERSEDED in
// scripts/convert/path_mapping.rb — so they must not count as nav
// orphans either. The Ruby table is the single source of truth; its
// entry format is stable (one `"path" => "reason",` per line) and is
// read here directly rather than duplicated into a second list.
let supersededCache: Set<string> | null = null
function getSuperseded(): Set<string> {
  if (supersededCache) return supersededCache
  supersededCache = new Set()
  try {
    const ruby = readFileSync(join(SOURCE_ROOT, 'scripts/convert/path_mapping.rb'), 'utf-8')
    const block = ruby.match(/SUPERSEDED\s*=\s*\{(.*?)\}\.freeze/s)
    if (block) {
      for (const m of block[1].matchAll(/^\s*"([^"]+)"\s*=>/gm)) {
        supersededCache.add(m[1])
      }
    }
  } catch {}
  return supersededCache
}

function resolveDirRefs(node: NavNode, baseDir: string): void {
  if (node.items) {
    for (const child of node.items) resolveDirRefs(child, baseDir)
  }
  if (node.dir) {
    const subDir = join(baseDir, node.dir)
    const subNav = readNavYml(subDir)
    if (subNav && subNav.items) {
      node.items = subNav.items
      for (const child of node.items) resolveDirRefs(child, subDir)
    }
    delete node.dir
  }
  if (node.file) {
    node.file = join(baseDir, node.file).replace(/\\/g, '/')
  }
}

function discoverNavFiles(dir: string, found: string[]): void {
  const navPath = join(SOURCE_ROOT, dir, '_nav.yml')
  if (existsSync(navPath)) {
    found.push(dir)
  }
  try {
    for (const name of readdirSync(join(SOURCE_ROOT, dir))) {
      if (SKIP_DIRS.has(name) || name.startsWith('.') || name.startsWith('__')) continue
      const subdir = join(dir, name)
      if (statSync(join(SOURCE_ROOT, subdir)).isDirectory()) {
        discoverNavFiles(subdir, found)
      }
    }
  } catch {}
}

function collectDirRefs(dir: string): Set<string> {
  const claimed = new Set<string>()
  function walk(d: string) {
    const nav = readNavYml(d)
    if (!nav || !nav.items) return
    for (const item of nav.items) {
      if (item.dir) {
        const subDir = join(d, item.dir)
        claimed.add(subDir)
        walk(subDir)
      }
    }
  }
  walk(dir)
  return claimed
}

// The tree build (sections.yml read + _nav.yml discovery walk) runs on
// FIRST call, not at import time: importing this module is side-effect
// free, and consumers that never need the nav never pay for it.
let navTreesCache: NavRoot[] | null = null

export function getNavTrees(): NavRoot[] {
  if (navTreesCache) return navTreesCache
  const trees: NavRoot[] = []
  const allNavDirs: Array<{ section: SectionEntry; dir: string }> = []

  for (const section of getContentRoots()) {
    const root = section.source_dir
    if (!existsSync(join(SOURCE_ROOT, root))) continue
    const found: string[] = []
    discoverNavFiles(root, found)
    const claimed = new Set<string>()
    for (const d of found) {
      for (const sub of collectDirRefs(d)) {
        claimed.add(sub)
      }
    }
    for (const d of found) {
      if (d === root || !claimed.has(d)) {
        allNavDirs.push({ section, dir: d })
      }
    }
  }

  for (const { section, dir } of allNavDirs) {
    const nav = readNavYml(dir)
    if (!nav) continue
    resolveDirRefs(nav, dir)
    if (!nav.title) {
      console.warn(`[nav] _nav.yml missing title: ${dir}/_nav.yml`)
    }
    trees.push({
      prefix: dirToPrefix(section, dir),
      title: nav.title || dir,
      items: nav.items || [],
    })
  }

  navTreesCache = trees.sort((a, b) => b.prefix.length - a.prefix.length)
  return navTreesCache
}

export function resolveNavTree(pathname: string): NavRoot | null {
  const normalized = pathname.replace(/\/$/, '') + '/'
  return getNavTrees().find(t => normalized.startsWith(t.prefix)) || null
}

// Map a nav `file:` entry (a source path after resolveDirRefs, e.g.
// _pages/install/macos) to its site URL. The owning section is the one
// with the longest matching source_dir; its output_prefix replaces the
// source_dir and every remaining segment is kebabed, mirroring the
// converter's output mapping. A trailing /index collapses to the
// directory URL (`file: index` is the section landing page — the source
// may live at the parent level, e.g. _pages/install.adoc → install/index).
// Files outside every section keep the historic identity mapping.
export function sourcePathToUrl(file: string): string {
  const normalized = file.replace(/\\/g, '/')
  const section = getSections()
    .filter(s => s.source_dir &&
      (normalized === s.source_dir || normalized.startsWith(s.source_dir + '/')))
    .sort((a, b) => b.source_dir.length - a.source_dir.length)[0]
  if (!section) {
    return '/' + normalized.replace(/\/index$/, '') + '/'
  }
  const rel = normalized === section.source_dir ? '' : normalized.slice(section.source_dir.length + 1)
  const relKebab = rel.split('/').map(kebabSegment).join('/')
  const joined = [section.output_prefix, relKebab].filter(Boolean).join('/')
  return ('/' + joined + '/').replace(/\/index\/$/, '/')
}

function collectAdocFiles(dir: string, base: string = dir): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(SOURCE_ROOT, dir))) {
    if (name.startsWith('_') || name.startsWith('.') || SKIP_DIRS.has(name) || name === 'docs') continue
    const full = join(dir, name)
    const rel = full.replace(base + '/', '')
    if (statSync(join(SOURCE_ROOT, full)).isDirectory()) {
      if (!existsSync(join(SOURCE_ROOT, full, '_nav.yml'))) {
        out.push(...collectAdocFiles(full, base))
      }
    } else if (name.endsWith('.adoc')) {
      out.push(rel)
    }
  }
  return out
}

export function validateAllNav(): Array<{ section: string; orphans: string[] }> {
  const results: Array<{ section: string; orphans: string[] }> = []
  for (const section of getContentRoots()) {
    const root = section.source_dir
    if (!existsSync(join(SOURCE_ROOT, root))) continue
    if (!existsSync(join(SOURCE_ROOT, root, '_nav.yml'))) continue

    const superseded = getSuperseded()
    const allFiles = collectAdocFiles(root, root)
      .map(f => join(root, f).replace(/\\/g, '/'))
      .filter(f => !superseded.has(f))
      .map(f => f.replace(/\.adoc$/, ''))

    const rootPrefix = dirToPrefix(section, root)
    const trees = getNavTrees().filter(t =>
      t.prefix === rootPrefix || t.prefix.startsWith(rootPrefix))

    const declared = new Set<string>()
    for (const tree of trees) {
      function collectDeclared(node: NavNode) {
        if (node.file) declared.add(node.file.replace(/\\/g, '/'))
        node.items?.forEach(collectDeclared)
      }
      tree.items.forEach(collectDeclared)
    }

    const orphans = allFiles.filter(f => !declared.has(f))
    if (orphans.length > 0) {
      results.push({ section: root, orphans })
    }
  }
  return results
}
