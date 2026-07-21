import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import type { LoaderContext } from 'astro/loaders'
import { mirrorLoader } from '../mirror-loader'
import { readAllEnvelopes } from '../../../lib/mirror-store'
import { collections } from '../../../content.config'

// REAL loader tests: run mirrorLoader().load with a fake LoaderContext
// (Map-backed store, recording logger). Previously this file tested a
// heading-extraction regex that no longer exists in the loader; its
// renderer-heading cases were already covered by
// src/lib/__tests__/mirror-renderer.test.ts.

const schema = collections.mirror.schema
if (!schema || typeof schema === 'function') {
  throw new Error('content.config.ts mirror collection must use a static zod schema')
}

// Minimal structural stand-in for Astro's MutableDataStore: the loader
// only uses set({id, data}) and clear().
class FakeStore {
  private map = new Map<string, any>()
  set(entry: { id: string; data: any }): void {
    this.map.set(entry.id, entry.data)
  }
  clear(): void {
    this.map.clear()
  }
  get(id: string): any {
    return this.map.get(id)
  }
  has(id: string): boolean {
    return this.map.has(id)
  }
  get size(): number {
    return this.map.size
  }
  ids(): string[] {
    return [...this.map.keys()]
  }
}

function makeCtx() {
  const store = new FakeStore()
  const warnings: string[] = []
  const logger = {
    warn: (m: string) => { warnings.push(m) },
    info: () => {},
  }
  const ctx = { store, logger } as unknown as LoaderContext
  return { store, warnings, ctx }
}

describe('mirrorLoader against the real mirror-json tree', () => {
  it('loads every envelope, schema-conformant, with no manifest entry', async () => {
    const { store, ctx } = makeCtx()
    await mirrorLoader().load(ctx)

    const envelopes = await readAllEnvelopes()
    expect(store.size).toBe(envelopes.length)
    expect(store.has('manifest')).toBe(false)

    for (const id of store.ids()) {
      const parsed = schema.safeParse(store.get(id))
      expect(parsed.success, `entry "${id}" conforms to content.config.ts schema`).toBe(true)
    }
  }, 300_000)
})

describe('mirrorLoader against a synthetic tree', () => {
  let root: string
  let prevCwd: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mirror-loader-'))
    mkdirSync(join(root, 'mirror-json'), { recursive: true })
    prevCwd = process.cwd()
    process.chdir(root)
  })

  afterEach(() => {
    process.chdir(prevCwd)
    rmSync(root, { recursive: true, force: true })
  })

  function writeEnvelope(rel: string, data: Record<string, unknown>): void {
    const full = join(root, 'mirror-json', rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, JSON.stringify(data))
  }

  function clauseDoc(title: string, body = 'Body.'): string {
    return JSON.stringify({
      type: 'doc',
      content: [{
        type: 'clause',
        attrs: { title, level: 1 },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
      }],
    })
  }

  it('strips the first heading when it duplicates the page title', async () => {
    writeEnvelope('my-page.json', {
      source: '_pages/my-page.adoc',
      title: 'My Page',
      frontmatter: {},
      mirror_json: clauseDoc('My Page'),
    })
    const { store, ctx } = makeCtx()
    await mirrorLoader().load(ctx)

    const data = store.get('my-page')
    expect(data.title).toBe('My Page')
    expect(data.headings).toEqual([])
    expect(data.rendered_html).not.toContain('<h2')
    expect(data.rendered_html).toContain('Body.')
    expect(schema.safeParse(data).success).toBe(true)
  })

  it('keeps the first heading when it differs from the page title', async () => {
    writeEnvelope('other.json', {
      source: 'other.adoc',
      title: 'Other Title',
      frontmatter: {},
      mirror_json: clauseDoc('A Section'),
    })
    const { store, ctx } = makeCtx()
    await mirrorLoader().load(ctx)

    const data = store.get('other')
    expect(data.headings).toEqual([{ depth: 2, slug: 'a-section', text: 'A Section' }])
    expect(data.rendered_html).toContain('<h2 id="a-section">A Section</h2>')
  })

  it('passes redirect_from through as a flat string array', async () => {
    writeEnvelope('redir.json', {
      source: 'redir.adoc',
      title: 'Redir',
      frontmatter: { redirect_from: '/legacy/' },
      mirror_json: clauseDoc('Redir'),
    })
    writeEnvelope('multi.json', {
      source: 'multi.adoc',
      title: 'Multi',
      frontmatter: { redirect_from: ['/a/', '/b/'] },
      mirror_json: clauseDoc('Multi'),
    })
    const { store, ctx } = makeCtx()
    await mirrorLoader().load(ctx)

    expect(store.get('redir').redirect_from).toEqual(['/legacy/'])
    expect(store.get('multi').redirect_from).toEqual(['/a/', '/b/'])
    expect(store.get('redir').frontmatter.redirect_from).toBe('/legacy/')
  })

  it('collapses /index files to their directory id', async () => {
    writeEnvelope('sub/index.json', {
      source: 'sub.adoc',
      title: 'Sub',
      frontmatter: {},
      mirror_json: clauseDoc('Sub'),
    })
    const { store, ctx } = makeCtx()
    await mirrorLoader().load(ctx)
    expect(store.has('sub')).toBe(true)
    expect(store.has('sub/index')).toBe(false)
  })

  it('skips the manifest and unparseable files with a warning', async () => {
    writeEnvelope('manifest.json', { stats: { ok: 1 } })
    writeFileSync(join(root, 'mirror-json', 'broken.json'), 'not json {')
    writeEnvelope('ok.json', {
      source: 'ok.adoc',
      title: 'OK',
      frontmatter: {},
      mirror_json: clauseDoc('OK'),
    })
    const { store, warnings, ctx } = makeCtx()
    await mirrorLoader().load(ctx)

    expect(store.ids()).toEqual(['ok'])
    expect(warnings.some(w => w.includes('broken.json'))).toBe(true)
  })

  it('clears the store before loading (no ghost entries from deleted files)', async () => {
    writeEnvelope('present.json', {
      source: 'present.adoc',
      title: 'Present',
      frontmatter: {},
      mirror_json: clauseDoc('Present'),
    })
    const { store, ctx } = makeCtx()
    store.set({ id: 'ghost-of-deleted-file', data: { stale: true } })
    await mirrorLoader().load(ctx)

    expect(store.has('ghost-of-deleted-file')).toBe(false)
    expect(store.has('present')).toBe(true)
  })
})
