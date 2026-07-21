import { describe, expect, it } from 'vitest'
import { formatDate } from '../format-date'

describe('formatDate', () => {
  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('')
  })

  it('returns empty string for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('')
    expect(formatDate('2018-13-99')).toBe('')
  })

  it('formats ISO dates in en-US long form', () => {
    expect(formatDate('2018-08-24T12:00:00Z')).toBe('August 24, 2018')
  })

  it('formats Ruby/Jekyll-style space-separated dates', () => {
    expect(formatDate('2018-08-24 12:00:00 +0000')).toBe('August 24, 2018')
  })

  it('formats ISO dates with nanosecond precision', () => {
    expect(formatDate('2018-08-24T12:00:00.000000000+00:00')).toBe('August 24, 2018')
  })

  it('formats dates without a time component', () => {
    // Date-only parses as UTC midnight; assert the long-form shape
    // rather than a specific day (timezone-dependent near midnight).
    expect(formatDate('2018-08-24')).toMatch(/August 2[34], 2018/)
  })
})
