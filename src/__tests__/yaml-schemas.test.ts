// Every YAML data file in the repo must conform to its JSON Schema —
// this suite runs the exact same checks as scripts/check-schemas.mjs
// (shared core: scripts/lib/schema-check.mjs), so `npm test` and the
// `check:schemas` CI gate can never disagree.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { checkAllSchemas, CHECKS } from '../../scripts/lib/schema-check.mjs'

describe('YAML data schemas', () => {
  it('covers every declared data kind', () => {
    const kinds = CHECKS.map(c => c.kind)
    expect(kinds).toEqual([
      'attribute manifest',
      'section registry',
      'nav tree',
      'root labels',
    ])
  })

  it('all YAML data files conform to their schemas', async () => {
    const failures = await checkAllSchemas()
    expect(
      failures.map(f => `${f.file} (${f.kind}): ${f.errors.join('; ')}`),
    ).toEqual([])
  })

  it('generated schemas are in sync with the zod models', () => {
    // scripts/build-schemas.mjs --check exits 1 on drift.
    expect(() =>
      execFileSync('node', ['scripts/build-schemas.mjs', '--check'], { stdio: 'pipe' }),
    ).not.toThrow()
  })
})
