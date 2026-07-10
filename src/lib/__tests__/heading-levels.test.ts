import { describe, expect, it } from 'vitest'
import {
  sectionLevelToHeadingLevel,
  MAX_HEADING_LEVEL,
} from '../heading-levels'

describe('sectionLevelToHeadingLevel', () => {
  it('offsets level by 1 (section level 1 → h2)', () => {
    expect(sectionLevelToHeadingLevel(1)).toBe(2)
  })

  it('offsets deeper levels (level 2 → h3, level 3 → h4)', () => {
    expect(sectionLevelToHeadingLevel(2)).toBe(3)
    expect(sectionLevelToHeadingLevel(3)).toBe(4)
  })

  it('clamps at HTML max h6', () => {
    expect(sectionLevelToHeadingLevel(5)).toBe(MAX_HEADING_LEVEL)
    expect(sectionLevelToHeadingLevel(6)).toBe(MAX_HEADING_LEVEL)
    expect(sectionLevelToHeadingLevel(99)).toBe(MAX_HEADING_LEVEL)
  })

  it('defaults missing/invalid level to section level 1 → h2', () => {
    expect(sectionLevelToHeadingLevel(undefined)).toBe(2)
    expect(sectionLevelToHeadingLevel(0)).toBe(2)
    expect(sectionLevelToHeadingLevel(-1)).toBe(2)
  })
})
