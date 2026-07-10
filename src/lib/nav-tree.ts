// Declarative navigation tree reader.
//
// Content roots are defined in src/config/content.yml.
// Each directory with a _nav.yml gets a sidebar.
// URLs are file paths — no transformation, no mapping tables.

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

// Content roots from src/config/content.yml.
const CONFIG = load(readFileSync(join(SOURCE_ROOT, 'src/config/content.yml'), 'utf-8')) as { roots: string[] }
const CONTENT_ROOTS = CONFIG.roots

const SKIP_DIRS = new Set(['node_modules', '_upstream', 'dist', '.astro',
  '.git', 'SUPERSEDED', 'scripts', 'src', 'public', 'mirror-json',
  '.github', '.playwright-mcp', '.jekyll-cache'])

function dirToPrefix(dir: string): string {
  return '/' + dir + '/'
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

export const navTrees: NavRoot[] = (() => {
  const trees: NavRoot[] = []
  const allNavDirs: string[] = []

  for (const root of CONTENT_ROOTS) {
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
        allNavDirs.push(d)
      }
    }
  }

  for (const dir of allNavDirs) {
    const nav = readNavYml(dir)
    if (!nav) continue
    resolveDirRefs(nav, dir)
    if (!nav.title) {
      console.warn(`[nav] _nav.yml missing title: ${dir}/_nav.yml`)
    }
    trees.push({
      prefix: dirToPrefix(dir),
      title: nav.title || dir,
      items: nav.items || [],
    })
  }

  return trees.sort((a, b) => b.prefix.length - a.prefix.length)
})()

export function resolveNavTree(pathname: string): NavRoot | null {
  const normalized = pathname.replace(/\/$/, '') + '/'
  return navTrees.find(t => normalized.startsWith(t.prefix)) || null
}

export function sourcePathToUrl(file: string): string {
  return '/' + file.replace(/\/index$/, '').replace(/\\/g, '/') + '/'
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
  for (const root of CONTENT_ROOTS) {
    if (!existsSync(join(SOURCE_ROOT, root))) continue
    if (!existsSync(join(SOURCE_ROOT, root, '_nav.yml'))) continue

    const allFiles = collectAdocFiles(root, root).map(f =>
      join(root, f).replace(/\\/g, '/').replace(/\.adoc$/, '')
    )

    const rootPrefix = dirToPrefix(root)
    const trees = navTrees.filter(t =>
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
