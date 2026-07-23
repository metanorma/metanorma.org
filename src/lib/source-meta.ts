// Source-page metadata: edit-on-GitHub URL + lastmod (git mtime).
//
// One helper for every page backed by a source file. The repo URL is
// fixed (this site); the branch is `main` (where edit links land by
// convention). Both lookups are cached: a git log per file is expensive
// across hundreds of envelopes, so we batch-collect mtimes once.

import { execSync } from 'node:child_process'

export const REPO_EDIT_BASE =
  'https://github.com/metanorma/metanorma.org/edit/main/'

export function editUrlFor(source?: string | null): string | null {
  if (!source) return null
  return REPO_EDIT_BASE + source.replace(/^\/+/, '')
}

// Per-process cache of source path → ISO lastmod. Populated lazily; safe
// to call repeatedly from many pages.
const lastmodCache = new Map<string, string | null>()

function gitLastmod(source: string): string | null {
  if (lastmodCache.has(source)) return lastmodCache.get(source) ?? null
  let value: string | null = null
  try {
    const iso = execSync(
      `git log -1 --format=%cI -- ${JSON.stringify(source)}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) value = iso
  } catch {
    value = null
  }
  lastmodCache.set(source, value)
  return value
}

export function lastmodFor(source?: string | null): string | null {
  if (!source) return null
  return gitLastmod(source)
}
