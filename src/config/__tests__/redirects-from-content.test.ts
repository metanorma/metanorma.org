import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractRedirects } from '../../lib/mirror-store'

// Verify redirect_from extraction using the REAL extractRedirects from
// src/lib/mirror-store.ts (previously this file re-implemented the
// function and tested the copy).

const __dirname = dirname(fileURLToPath(import.meta.url))
// Repo-root mirror-json/ (two levels up from src/config/__tests__).
const MIRROR_DIR = join(__dirname, '..', '..', '..', 'mirror-json')

describe('extractRedirects (mirror-store)', () => {
  it('returns empty array when frontmatter has no redirect_from', () => {
    expect(extractRedirects({})).toEqual([])
    expect(extractRedirects(undefined)).toEqual([])
  })

  it('returns single-element array when redirect_from is a string', () => {
    expect(extractRedirects({ redirect_from: '/old-url/' })).toEqual(['/old-url/'])
  })

  it('returns array when redirect_from is an array', () => {
    expect(extractRedirects({ redirect_from: ['/a/', '/b/'] })).toEqual(['/a/', '/b/'])
  })

  it('coerces non-string entries to strings', () => {
    expect(extractRedirects({ redirect_from: [123, '/str/'] })).toEqual(['123', '/str/'])
    expect(extractRedirects({ redirect_from: 42 })).toEqual(['42'])
  })

  it('real-world: blog post with a frontmatter-date-mismatch redirect', () => {
    // The converter injects a legacy redirect for posts whose frontmatter
    // date differs from the filename date. This is one known instance.
    const path = join(MIRROR_DIR, 'blog', '2019-10-09-metanorma-accessibility-html-word.json')
    expect(existsSync(path)).toBe(true)
    const env = JSON.parse(readFileSync(path, 'utf-8'))
    expect(extractRedirects(env.frontmatter))
      .toContain('/blog/2019-10-08-metanorma-accessibility-html-word/')
  })

  it('real-world: envelope without redirects yields an empty list', () => {
    const path = join(MIRROR_DIR, 'blog', '2018-12-11-writing-metanorma-in-asciadoc.json')
    expect(existsSync(path)).toBe(true)
    const env = JSON.parse(readFileSync(path, 'utf-8'))
    expect(extractRedirects(env.frontmatter)).toEqual([])
  })
})
