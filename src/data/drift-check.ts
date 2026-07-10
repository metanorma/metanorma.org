// Catalog drift check: verifies that every flavor gem in the software
// catalog references a valid flavor ID in the flavors catalog.
//
// Runs in dev mode (import.meta.env.DEV) so production builds stay quiet.
// Extracted from data/index.ts so the re-export file is just re-exports.

import { flavors } from './flavors'
import { gems } from './software'

export function checkFlavorDrift(): string[] {
  const flavorIds = new Set(flavors.map(f => f.id))
  return gems
    .filter(g => g.category === 'flavor' && g.flavorId && !flavorIds.has(g.flavorId))
    .map(g => `${g.id} → flavorId '${g.flavorId}' not in flavors`)
}

if (import.meta.env.DEV) {
  const orphans = checkFlavorDrift()
  if (orphans.length) {
    console.error('[catalog] software.flavorId orphans:\n  ' + orphans.join('\n  '))
  }
}
