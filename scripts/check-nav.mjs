#!/usr/bin/env node
// Standalone nav-coverage check: source .adoc pages not declared in any
// _nav.yml ("orphans" — reachable only by direct URL, invisible in the
// sidebar). Prints them grouped by section and exits 1 when any exist.
// Superseded sources (Convert::PathMapping::SUPERSEDED — removed from
// the site, kept on disk) are excluded, matching the converter.
//
// This replaces the old import-time DEV validateAllNav() warning in
// src/config/site.ts: importing site config is now side-effect free,
// and coverage is checked on demand (`npm run check:nav`) — a later
// phase wires it into CI.
//
// Run from the repo root (nav-tree resolves paths against process.cwd()).
// Node ≥ 23.6 runs the TypeScript import natively (type stripping).

import { validateAllNav } from '../src/lib/nav-tree.ts'

const gaps = validateAllNav()

if (gaps.length === 0) {
  console.log('[check-nav] OK — every page is declared in a _nav.yml')
  process.exit(0)
}

let total = 0
console.error('[check-nav] Pages not declared in _nav.yml:')
for (const gap of gaps) {
  console.error(`  ${gap.section} (${gap.orphans.length}):`)
  for (const orphan of gap.orphans) {
    console.error(`    ${orphan}`)
    total++
  }
}
console.error(`[check-nav] ${total} orphan page(s) in ${gaps.length} section(s)`)
process.exit(1)
