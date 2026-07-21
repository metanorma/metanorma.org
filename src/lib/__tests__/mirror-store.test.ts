import { describe, expect, it } from 'vitest'
import {
  slugFromFile,
  extractRedirects,
  isEnvelopeFile,
  readAllEnvelopes,
} from '../mirror-store'

describe('slugFromFile', () => {
  it('strips the .json extension', () => {
    expect(slugFromFile('author/iso.json')).toBe('author/iso')
  })

  it('collapses a trailing /index', () => {
    expect(slugFromFile('author/iso/index.json')).toBe('author/iso')
    expect(slugFromFile('install/index.json')).toBe('install')
  })

  it('does not collapse index mid-path', () => {
    expect(slugFromFile('author/index/topics.json')).toBe('author/index/topics')
  })

  it('keeps a bare top-level "index" (no slash to collapse)', () => {
    expect(slugFromFile('index.json')).toBe('index')
  })
})

describe('extractRedirects', () => {
  it('returns [] for absent frontmatter / redirect_from', () => {
    expect(extractRedirects(undefined)).toEqual([])
    expect(extractRedirects({})).toEqual([])
  })

  it('wraps a scalar in an array', () => {
    expect(extractRedirects({ redirect_from: '/old/' })).toEqual(['/old/'])
  })

  it('passes arrays through as strings', () => {
    expect(extractRedirects({ redirect_from: ['/a/', '/b/'] })).toEqual(['/a/', '/b/'])
  })

  it('coerces numbers and numeric arrays to strings', () => {
    expect(extractRedirects({ redirect_from: 123 })).toEqual(['123'])
    expect(extractRedirects({ redirect_from: [1, '/x/'] })).toEqual(['1', '/x/'])
  })
})

describe('isEnvelopeFile', () => {
  it('excludes the converter manifest', () => {
    expect(isEnvelopeFile('manifest.json')).toBe(false)
  })

  it('accepts normal page envelopes', () => {
    expect(isEnvelopeFile('author/iso.json')).toBe(true)
    expect(isEnvelopeFile('index.json')).toBe(true)
  })
})

describe('readAllEnvelopes (real repo-root mirror-json/)', () => {
  it('reads the full tree with no manifest slug and well-formed entries', async () => {
    const envelopes = await readAllEnvelopes()

    expect(envelopes.length).toBeGreaterThan(400)
    expect(envelopes.some(e => e.slug === 'manifest')).toBe(false)

    for (const env of envelopes) {
      expect(env.slug, 'every entry has a slug').toBeTruthy()
      expect(env.frontmatter, `entry ${env.slug} has frontmatter`).toBeTypeOf('object')
      expect(Array.isArray(env.redirect_from)).toBe(true)
    }
  })

  it('collapses /index envelopes to their directory slug', async () => {
    const envelopes = await readAllEnvelopes()
    // mirror-json/install/index.json must surface as slug "install".
    expect(envelopes.some(e => e.slug === 'install')).toBe(true)
    expect(envelopes.some(e => e.slug.endsWith('/index'))).toBe(false)
  })
})
