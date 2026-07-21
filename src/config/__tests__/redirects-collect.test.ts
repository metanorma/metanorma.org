import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { collectRedirectFromEntries, mergeRedirects } from '../redirects-from-content.mjs'
import { readAllEnvelopes } from '../../lib/mirror-store'

// collectRedirectFromEntries takes the envelope array directly (the
// caller — astro.config.mjs — reads mirror-json ONCE and shares the
// result). These specs build a synthetic tree in a temp dir, chdir
// into it (restored after each test), and read it via the real
// readAllEnvelopes.

let root: string
let prevCwd: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'redir-collect-'))
  mkdirSync(join(root, 'mirror-json'), { recursive: true })
  prevCwd = process.cwd()
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

async function collect(): Promise<Record<string, string>> {
  process.chdir(root)
  return collectRedirectFromEntries(await readAllEnvelopes()) as Record<string, string>
}

describe('collectRedirectFromEntries', () => {
  it('maps each redirect_from to the envelope slug target', async () => {
    writeEnvelope('page-a.json', { frontmatter: { redirect_from: ['/old-a/'] } })
    expect(await collect()).toEqual({ '/old-a/': '/page-a/' })
  })

  it('cleans missing/extra slashes on sources', async () => {
    writeEnvelope('page-a.json', { frontmatter: { redirect_from: ['bare-path', '/trailing/'] } })
    expect(await collect()).toEqual({
      '/bare-path/': '/page-a/',
      '/trailing/': '/page-a/',
    })
  })

  it('collapses /index envelopes to their directory target', async () => {
    writeEnvelope('dir/index.json', { frontmatter: { redirect_from: ['/old-dir/'] } })
    expect(await collect()).toEqual({ '/old-dir/': '/dir/' })
  })

  it('current behavior: a root index.json collapses to target "//"', async () => {
    // The /^index$/ collapse on slug "index" yields an empty segment.
    // No such envelope exists on the site today; pin the behavior so a
    // refactor decides deliberately.
    writeEnvelope('index.json', { frontmatter: { redirect_from: ['/old-root/'] } })
    expect(await collect()).toEqual({ '/old-root/': '//' })
  })

  it('skips self-redirects', async () => {
    writeEnvelope('selfref.json', { frontmatter: { redirect_from: ['/selfref/'] } })
    expect(await collect()).toEqual({})
  })

  it('skips entries that clean to an empty path', async () => {
    writeEnvelope('page-a.json', { frontmatter: { redirect_from: ['/'] } })
    expect(await collect()).toEqual({})
  })

  it('throws a build-time error when one source maps to two different targets', async () => {
    writeEnvelope('dup-a.json', { frontmatter: { redirect_from: ['/dup/'] } })
    writeEnvelope('dup-b.json', { frontmatter: { redirect_from: ['/dup/'] } })
    await expect(collect()).rejects.toThrow(/redirect_from collisions/)
  })

  it('the collision error lists the source, both targets, and both owning slugs', async () => {
    writeEnvelope('dup-a.json', { frontmatter: { redirect_from: ['/dup/'] } })
    writeEnvelope('dir/dup-b.json', { frontmatter: { redirect_from: ['/dup/'] } })
    await expect(collect()).rejects.toThrow(
      /\/dup\/ → \/dup-a\/ \(\/dup-a\) vs \/dir\/dup-b\/ \(\/dir\/dup-b\)/
    )
  })

  it('ignores the converter manifest and unparseable files', async () => {
    writeEnvelope('manifest.json', { stats: { ok: 1 }, frontmatter: { redirect_from: ['/bogus/'] } })
    writeEnvelope('page-a.json', { frontmatter: { redirect_from: ['/old-a/'] } })
    writeFileSync(join(root, 'mirror-json', 'broken.json'), 'not json {')
    expect(await collect()).toEqual({ '/old-a/': '/page-a/' })
  })
})

describe('mergeRedirects', () => {
  it('merges maps left-to-right', () => {
    expect(mergeRedirects(
      ['a', { '/x/': '/1/' }],
      ['b', { '/y/': '/2/' }],
    )).toEqual({ '/x/': '/1/', '/y/': '/2/' })
  })

  it('allows the same source in two maps when the target is identical', () => {
    expect(mergeRedirects(
      ['a', { '/x/': '/same/' }],
      ['b', { '/x/': '/same/' }],
    )).toEqual({ '/x/': '/same/' })
  })

  it('throws when one source maps to two different targets, listing labels', () => {
    expect(() => mergeRedirects(
      ['static legacy', { '/x/': '/a/' }],
      ['flavor hubs', { '/y/': '/b/' }],
      ['content redirect_from', { '/x/': '/c/' }],
    )).toThrow(/\/x\/ → \/a\/ \(static legacy\) vs \/c\/ \(content redirect_from\)/)
  })

  it('lists every collision in one error, not just the first', () => {
    let err: Error | null = null
    try {
      mergeRedirects(
        ['a', { '/x/': '/1/', '/y/': '/2/' }],
        ['b', { '/x/': '/3/', '/y/': '/4/' }],
      )
    } catch (e) {
      err = e as Error
    }
    expect(err).not.toBeNull()
    expect(err!.message).toContain('/x/')
    expect(err!.message).toContain('/y/')
  })
})
