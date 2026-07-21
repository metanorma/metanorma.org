// Single source of truth for reading mirror-json envelopes from disk.
//
// Three consumers (mirror-loader, posts.ts, redirects-from-content.mjs)
// previously each walked the mirror-json/ tree independently with their
// own copy of the glob+parse+slug pipeline. This module concentrates
// that logic behind one interface so the directory path, slug rule,
// and redirect normalization live in exactly one place.

import { glob, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Apply fn to items with bounded concurrency, preserving input order in
// the output array. Envelope reads/renders are the loader bottleneck —
// sequential readFile+render per entry — so both are batched (chunks of
// `concurrency` under Promise.all). Order stays deterministic because
// results are collected by position, not completion.
export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const results = await Promise.all(chunk.map(fn))
    for (let j = 0; j < results.length; j++) out[i + j] = results[j]
  }
  return out
}

export const MIRROR_DIR = 'mirror-json'

// The converter writes run metadata (stats, file_map) to
// mirror-json/manifest.json — it is not a page envelope.
const NON_ENVELOPE_FILES = new Set(['manifest.json'])

export function isEnvelopeFile(file: string): boolean {
  return !NON_ENVELOPE_FILES.has(file)
}

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

export interface ReadEnvelopesOptions {
  // Called for each file that fails to read/parse (the file is skipped).
  // Absent = skip silently (the caller decides whether to log).
  onError?: (file: string, err: Error) => void
  // Read concurrency (files read in parallel per chunk). Default 16.
  concurrency?: number
}

// Walk all mirror-json envelopes and return them as a flat array in
// glob (sorted-path) order. Files that fail to parse are skipped.
export async function readAllEnvelopes(options: ReadEnvelopesOptions = {}): Promise<MirrorEnvelope[]> {
  if (!existsSync(MIRROR_DIR)) return []
  const files: string[] = []
  for await (const file of glob('**/*.json', { cwd: MIRROR_DIR })) {
    if (isEnvelopeFile(file)) files.push(file)
  }
  const read = async (file: string): Promise<MirrorEnvelope | null> => {
    try {
      const raw = JSON.parse(await readFile(join(MIRROR_DIR, file), 'utf-8'))
      return toEnvelope(slugFromFile(file), raw)
    } catch (err) {
      options.onError?.(file, err as Error)
      return null
    }
  }
  const envelopes = await mapConcurrent(files, options.concurrency ?? 16, read)
  return envelopes.filter((e): e is MirrorEnvelope => e !== null)
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
