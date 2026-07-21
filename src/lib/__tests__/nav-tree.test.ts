import { describe, expect, it, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getNavTrees, resolveNavTree, sourcePathToUrl, validateAllNav } from '../nav-tree'

// nav-tree reads the repo (src/config/sections.yml + _nav.yml files)
// relative to process.cwd(), building the trees lazily on first
// getNavTrees() call. The statically imported module above reflects the
// REAL repo; synthetic trees are tested by chdir + module re-import in
// the second describe block.

const SECTIONS_YML = [
  'sections:',
  '  - id: docs',
  '    source_dir: docs',
  '    output_prefix: docs',
  '    nav_root: true',
  '    mapping: tree',
  '',
].join('\n')

describe('nav-tree against the real repo', () => {
  it('builds trees sorted longest-prefix-first', () => {
    const navTrees = getNavTrees()
    expect(navTrees.length).toBeGreaterThan(10)
    for (let i = 1; i < navTrees.length; i++) {
      expect(navTrees[i - 1].prefix.length).toBeGreaterThanOrEqual(navTrees[i].prefix.length)
    }
    for (const tree of navTrees) {
      expect(tree.prefix).toMatch(/^\//)
      expect(tree.prefix).toMatch(/\/$/)
    }
  })

  it('getNavTrees caches: the same array instance comes back', () => {
    expect(getNavTrees()).toBe(getNavTrees())
  })

  it('resolveNavTree matches the longest prefix', () => {
    // /learn/lessons/ is its own nav tree nested under /learn/.
    expect(resolveNavTree('/learn/lessons/some-lesson/')?.prefix).toBe('/learn/lessons/')
    expect(resolveNavTree('/learn/exercises-code/')?.prefix).toBe('/learn/exercises-code/')
  })

  it('resolveNavTree falls back to the parent tree', () => {
    // flavor navs claim their subdirectories, so no deeper tree exists.
    expect(resolveNavTree('/flavors/iso/topics/blocks/')?.prefix).toBe('/flavors/iso/')
    expect(resolveNavTree('/author/basics/workflow/')?.prefix).toBe('/author/')
  })

  it('resolveNavTree normalizes a missing trailing slash', () => {
    expect(resolveNavTree('/learn/lessons')?.prefix).toBe('/learn/lessons/')
    expect(resolveNavTree('/author')?.prefix).toBe('/author/')
  })

  it('resolveNavTree returns null for paths outside every tree', () => {
    expect(resolveNavTree('/totally-unknown/')).toBeNull()
    expect(resolveNavTree('/blog/')).toBeNull()
  })

  it('sourcePathToUrl maps source paths to clean URLs', () => {
    expect(sourcePathToUrl('author/basics/workflow')).toBe('/author/basics/workflow/')
    expect(sourcePathToUrl('author/index')).toBe('/author/')
    expect(sourcePathToUrl('index')).toBe('/index/')
  })

  it('sourcePathToUrl translates sections whose source_dir differs from output_prefix', () => {
    // install: _pages/install → /install/ (prefix mapping kind)
    expect(sourcePathToUrl('_pages/install/macos')).toBe('/install/macos/')
    expect(sourcePathToUrl('_pages/install/index')).toBe('/install/')
  })

  it('resolveNavTree resolves the install tree in URL space', () => {
    expect(resolveNavTree('/install/macos/')?.prefix).toBe('/install/')
    expect(resolveNavTree('/install/cicd-github/')?.prefix).toBe('/install/')
    expect(resolveNavTree('/install')?.prefix).toBe('/install/')
  })

  it('validateAllNav reports orphan shape per section', () => {
    const results = validateAllNav()
    expect(Array.isArray(results)).toBe(true)
    for (const r of results) {
      expect(typeof r.section).toBe('string')
      expect(Array.isArray(r.orphans)).toBe(true)
      for (const o of r.orphans) expect(typeof o).toBe('string')
    }
  })

  it('validateAllNav reports zero orphans in the real repo', () => {
    // Every live source page is declared in a _nav.yml; superseded
    // sources (e.g. author/getting-started.adoc) are excluded via the
    // converter's SUPERSEDED table. scripts/check-nav.mjs asserts this.
    expect(validateAllNav()).toEqual([])
  })
})

describe('nav-tree against a synthetic source root', () => {
  let root: string
  let prevCwd: string

  afterEach(() => {
    process.chdir(prevCwd)
    rmSync(root, { recursive: true, force: true })
    vi.resetModules()
  })

  async function loadNavTree(files: Record<string, string>) {
    root = mkdtempSync(join(tmpdir(), 'nav-tree-'))
    prevCwd = process.cwd()
    for (const [rel, content] of Object.entries(files)) {
      const full = join(root, rel)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, content)
    }
    process.chdir(root)
    vi.resetModules()
    return import('../nav-tree')
  }

  it('discovers _nav.yml trees and resolves dir/file refs', async () => {
    const mod = await loadNavTree({
      'src/config/sections.yml': SECTIONS_YML,
      'docs/_nav.yml': [
        'title: Docs',
        'items:',
        '  - title: Page One',
        '    file: page-one',
        '  - title: Sub Section',
        '    dir: sub',
        '',
      ].join('\n'),
      'docs/sub/_nav.yml': [
        'title: Sub',
        'items:',
        '  - title: Deep',
        '    file: deep',
        '',
      ].join('\n'),
    })

    const navTrees = mod.getNavTrees()
    expect(navTrees).toHaveLength(1)
    const tree = navTrees[0]
    expect(tree.prefix).toBe('/docs/')
    expect(tree.title).toBe('Docs')
    // file: refs are resolved to full source paths.
    expect(tree.items[0].file).toBe('docs/page-one')
    // dir: refs are replaced by the referenced nav's items (claimed, so
    // docs/sub does not become its own tree).
    const sub = tree.items[1]
    expect(sub.dir).toBeUndefined()
    expect(sub.items?.[0].file).toBe('docs/sub/deep')

    expect(mod.resolveNavTree('/docs/page-one/')?.prefix).toBe('/docs/')
    expect(mod.sourcePathToUrl(tree.items[0].file!)).toBe('/docs/page-one/')
  })

  it('skips a root whose _nav.yml is malformed', async () => {
    const mod = await loadNavTree({
      'src/config/sections.yml': SECTIONS_YML,
      'docs/_nav.yml': ':\n  - [not valid yaml',
    })
    expect(mod.getNavTrees()).toEqual([])
    expect(mod.resolveNavTree('/docs/anything/')).toBeNull()
  })

  it('falls back to the directory name when _nav.yml has no title', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const mod = await loadNavTree({
        'src/config/sections.yml': SECTIONS_YML,
        'docs/_nav.yml': 'items:\n  - title: Only Page\n    file: only\n',
      })
      expect(mod.getNavTrees()).toHaveLength(1)
      expect(mod.getNavTrees()[0].title).toBe('docs')
    } finally {
      warn.mockRestore()
    }
  })

  it('maps a section with source_dir != output_prefix into URL space', async () => {
    const mod = await loadNavTree({
      'src/config/sections.yml': [
        'sections:',
        '  - id: install',
        '    source_dir: _pages/install',
        '    output_prefix: install',
        '    nav_root: true',
        '    mapping: prefix',
        '',
      ].join('\n'),
      '_pages/install/_nav.yml': [
        'title: Install',
        'items:',
        '  - title: Overview',
        '    file: index',
        '  - title: macOS',
        '    file: macos',
        '',
      ].join('\n'),
    })

    const navTrees = mod.getNavTrees()
    expect(navTrees).toHaveLength(1)
    expect(navTrees[0].prefix).toBe('/install/')
    expect(navTrees[0].items[0].file).toBe('_pages/install/index')
    expect(mod.resolveNavTree('/install/macos/')?.prefix).toBe('/install/')
    expect(mod.resolveNavTree('/_pages/install/macos/')).toBeNull()
    expect(mod.sourcePathToUrl('_pages/install/macos')).toBe('/install/macos/')
    expect(mod.sourcePathToUrl('_pages/install/index')).toBe('/install/')
  })

  it('validateAllNav excludes sources listed in the converter SUPERSEDED table', async () => {
    const baseFiles: Record<string, string> = {
      'src/config/sections.yml': SECTIONS_YML,
      'docs/_nav.yml': 'title: Docs\nitems:\n  - title: Page One\n    file: page-one\n',
      'docs/page-one.adoc': '= Page One\n',
      'docs/page-two.adoc': '= Page Two\n',
    }
    const supersededRb = [
      'module Convert',
      '  module PathMapping',
      '    SUPERSEDED = {',
      '      "docs/page-two.adoc" => "removed from site",',
      '    }.freeze',
      '  end',
      'end',
      '',
    ].join('\n')

    // Without the table, the undeclared page is an orphan.
    let mod = await loadNavTree({ ...baseFiles, 'scripts/convert/path_mapping.rb': '' })
    expect(mod.validateAllNav()).toEqual([{ section: 'docs', orphans: ['docs/page-two'] }])

    // With the table entry, it is filtered out.
    mod = await loadNavTree({ ...baseFiles, 'scripts/convert/path_mapping.rb': supersededRb })
    expect(mod.validateAllNav()).toEqual([])
  })
})
