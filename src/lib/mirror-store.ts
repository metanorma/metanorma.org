// Single source of truth for reading mirror-json envelopes from disk.
//
// Three consumers (mirror-loader, posts.ts, redirects-from-content.mjs)
// previously each walked the mirror-json/ tree independently with their
// own copy of the glob+parse+slug pipeline. This module concentrates
// that logic behind one interface so the directory path, slug rule,
// and redirect normalization live in exactly one place.

import { glob } from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const MIRROR_DIR = 'mirror-json'

export interface MirrorEnvelope {
  slug: string
  source: string
  title: string
  frontmatter: Record<string, any>
  mirror_json: string
  redirect_from: string[]
}

// Derive the URL slug from a mirror-json file path.
// Strips .json extension and collapses a trailing /index (so
// author/iso/index.json → author/iso, matching clean-URL convention).
export function slugFromFile(file: string): string {
  return file.replace(/\.json$/, '').replace(/\/index$/, '')
}

// Normalize frontmatter `redirect_from` (Array | scalar | absent) to
// a flat string[]. The converter injects legacy snake_case URLs here.
export function extractRedirects(frontmatter: Record<string, any> | undefined): string[] {
  const raw = frontmatter?.redirect_from
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  return [String(raw)]
}

// Read a single envelope by slug, or null if missing.
export function readEnvelope(slug: string): MirrorEnvelope | null {
  const candidates = [
    join(MIRROR_DIR, `${slug}.json`),
    join(MIRROR_DIR, slug, 'index.json'),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8'))
      return toEnvelope(slug, raw)
    } catch {
      return null
    }
  }
  return null
}

// Walk all mirror-json envelopes and return them as a flat array.
// Skips files that fail to parse (logs nothing — caller decides).
export async function readAllEnvelopes(): Promise<MirrorEnvelope[]> {
  if (!existsSync(MIRROR_DIR)) return []
  const out: MirrorEnvelope[] = []
  for await (const file of glob('**/*.json', { cwd: MIRROR_DIR })) {
    const fullPath = join(MIRROR_DIR, file)
    let raw: any
    try {
      raw = JSON.parse(readFileSync(fullPath, 'utf-8'))
    } catch {
      continue
    }
    out.push(toEnvelope(slugFromFile(file), raw))
  }
  return out
}

function toEnvelope(slug: string, raw: any): MirrorEnvelope {
  const frontmatter = raw.frontmatter || {}
  return {
    slug,
    source: raw.source || slug,
    title: raw.title || '',
    frontmatter,
    mirror_json: raw.mirror_json || '',
    redirect_from: extractRedirects(frontmatter),
  }
}
