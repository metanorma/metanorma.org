#!/usr/bin/env node
// Validates every YAML data file in the repo against its JSON Schema
// (schemas/*.schema.json). Exit 1 with a readable report on any failure.

import { checkAllSchemas } from './lib/schema-check.mjs'

const failures = await checkAllSchemas()

if (failures.length === 0) {
  console.log('[check-schemas] OK — all YAML data files conform to their schemas')
} else {
  console.error(`[check-schemas] ${failures.length} file(s) failed schema validation:`)
  for (const f of failures) {
    console.error(`\n  ${f.file} (${f.kind})`)
    for (const err of f.errors) console.error(`    ${err}`)
  }
  process.exit(1)
}
