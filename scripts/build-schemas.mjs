#!/usr/bin/env node
// Generates zod models from the YAML schemas (the single source of
// truth) in schemas/*.schema.yaml. Hand-authored runtime models are
// replaced by generated code — edit the YAML, not the .generated.ts.
//
// Also meta-validates every YAML schema (malformed schemas fail here).
//
// Usage:
//   node scripts/build-schemas.mjs          # write
//   node scripts/build-schemas.mjs --check  # exit 1 if output would differ (drift gate)

import { readFileSync, writeFileSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import { join } from 'node:path'
import { load } from 'js-yaml'
import Ajv2020 from 'ajv/dist/2020.js'
import { generateZodModule } from './lib/yaml-zod-codegen.mjs'

const SCHEMA_DIR = 'schemas'

// Which YAML schemas get a generated zod module (the rest are
// validation-only contracts consumed via ajv).
const TARGETS = [
  {
    schema: 'attribute-manifest.schema.yaml',
    out: 'src/lib/attr-schema.generated.ts',
    root: 'attrManifestSchema',
  },
  {
    schema: 'frontmatter.schema.yaml',
    out: 'src/lib/frontmatter-schema.generated.ts',
    root: 'frontmatterSchema',
  },
]

const check = process.argv.includes('--check')
const ajv = new Ajv2020({ strict: false })

// 1. Meta-validate every YAML schema.
for await (const file of glob('*.schema.yaml', { cwd: SCHEMA_DIR })) {
  const path = join(SCHEMA_DIR, file)
  let schema
  try {
    schema = load(readFileSync(path, 'utf-8'))
  } catch (err) {
    console.error(`INVALID YAML: ${path}: ${err.message}`)
    process.exit(1)
  }
  try {
    ajv.compile(schema)
  } catch (err) {
    console.error(`INVALID SCHEMA: ${path}: ${err.message}`)
    process.exit(1)
  }
}

// 2. Generate zod modules.
let drift = false
for (const target of TARGETS) {
  const schemaPath = join(SCHEMA_DIR, target.schema)
  const schema = load(readFileSync(schemaPath, 'utf-8'))
  const text = generateZodModule({ schema, rootName: target.root, sourcePath: schemaPath })
  let current = null
  try {
    current = readFileSync(target.out, 'utf-8')
  } catch { /* not written yet */ }
  if (check) {
    if (current !== text) {
      console.error(`DRIFT: ${target.out} — regenerate with: node scripts/build-schemas.mjs`)
      drift = true
    }
  } else if (current !== text) {
    writeFileSync(target.out, text)
    console.log(`wrote ${target.out}`)
  }
}

if (drift) process.exit(1)
if (check) console.log('schemas in sync')
