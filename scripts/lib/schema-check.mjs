// Shared YAML data validation: every kind of YAML data in the repo is
// validated against its YAML schema (schemas/*.schema.yaml — the single
// source of truth; zod models are generated from them). Used by the
// scripts/check-schemas.mjs CLI and the vitest schema suite, so the CI
// gate and the test suite can never drift apart.

import Ajv2020 from 'ajv/dist/2020.js'
import { readFileSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import { join } from 'node:path'
import { load } from 'js-yaml'

export const SCHEMA_DIR = 'schemas'

// The YAML data kinds of the repository. Attribute-manifest and
// frontmatter schemas also drive generated zod models (see
// scripts/build-schemas.mjs); the rest are validation-only contracts.
export const CHECKS = [
  { kind: 'attribute manifest', schema: 'attribute-manifest.schema.yaml', files: ['attributes/*.yaml'] },
  { kind: 'section registry', schema: 'sections.schema.yaml', files: ['src/config/sections.yml'] },
  { kind: 'nav tree', schema: 'nav.schema.yaml', files: ['**/_nav.yml'] },
  { kind: 'root labels', schema: 'root-labels.schema.yaml', files: ['src/config/root-labels.yml'] },
]

const SKIP = /^(node_modules|dist|_upstream|\.git|\.astro|mirror-json|\.jekyll-cache)\//

async function* dataFiles(pattern) {
  for await (const file of glob(pattern)) {
    if (!SKIP.test(file)) yield file
  }
}

// Returns [{ kind, file, errors }] for every failing file (empty = all valid).
export async function checkAllSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const failures = []
  for (const check of CHECKS) {
    const validate = ajv.compile(
      load(readFileSync(join(SCHEMA_DIR, check.schema), 'utf-8')),
    )
    for (const pattern of check.files) {
      for await (const file of dataFiles(pattern)) {
        let data
        try {
          data = load(readFileSync(file, 'utf-8'))
        } catch (err) {
          failures.push({ kind: check.kind, file, errors: [`YAML parse error: ${err.message}`] })
          continue
        }
        if (!validate(data)) {
          failures.push({
            kind: check.kind,
            file,
            errors: (validate.errors || []).map(e => `${e.instancePath || '/'} ${e.message}`),
          })
        }
      }
    }
  }
  return failures
}
