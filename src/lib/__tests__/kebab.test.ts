import { describe, expect, it } from 'vitest'
import { kebabSegment, kebabPath } from '../kebab'

// PARITY: this table duplicates the kebab cases in
// spec/convert/path_mapping_spec.rb (Convert::PathMapping). Keep the
// two tables in sync — kebabSegment is THE kebab implementation on the
// site side, exactly as kebab_segment is on the converter side.

const KEBAB_SEGMENT_CASES: Array<[string, string]> = [
  ['my_snake_name', 'my-snake-name'],   // converts underscores to dashes
  ['my-kebab-name', 'my-kebab-name'],   // leaves already-kebab unchanged
  ['YAML_models', 'YAML-models'],       // preserves case
]

const KEBAB_PATH_CASES: Array<[string, string]> = [
  ['a_b/c_d', 'a-b/c-d'],               // kebabs every segment
]

describe('kebabSegment (THE kebab implementation, TS side)', () => {
  it.each(KEBAB_SEGMENT_CASES)('%s → %s', (input, expected) => {
    expect(kebabSegment(input)).toBe(expected)
  })
})

describe('kebabPath', () => {
  it.each(KEBAB_PATH_CASES)('%s → %s', (input, expected) => {
    expect(kebabPath(input)).toBe(expected)
  })

  it('matches kebabSegment for a single segment', () => {
    expect(kebabPath('a_b')).toBe(kebabSegment('a_b'))
  })
})
