import { describe, expect, it } from 'vitest'
import { normalizeDate } from '../blog-date'

describe('normalizeDate', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeDate(null)).toBe('')
    expect(normalizeDate(undefined)).toBe('')
    expect(normalizeDate('')).toBe('')
    expect(normalizeDate('   ')).toBe('')
  })

  it('passes through ISO 8601 with T separator unchanged', () => {
    expect(normalizeDate('2018-08-24T20:37:38+07:00')).toBe('2018-08-24T20:37:38+07:00')
    expect(normalizeDate('2018-08-24T20:37:38Z')).toBe('2018-08-24T20:37:38Z')
  })

  it('normalizes Ruby/Jekyll space-separated form with colon offset', () => {
    // The exact format that caused "Invalid Date" on production blog posts.
    expect(normalizeDate('2018-08-24 20:37:38.000000000 +07:00'))
      .toBe('2018-08-24T20:37:38.000+07:00')
  })

  it('normalizes Ruby/Jekyll space-separated form with no-colon offset', () => {
    expect(normalizeDate('2018-08-24 20:37:38 +0700'))
      .toBe('2018-08-24T20:37:38+07:00')
  })

  it('normalizes space-separated form with no offset', () => {
    expect(normalizeDate('2018-08-24 20:37:38'))
      .toBe('2018-08-24T20:37:38')
  })

  it('truncates nanoseconds to milliseconds (JS Date limit)', () => {
    expect(normalizeDate('2018-08-24 20:37:38.123456789 +07:00'))
      .toBe('2018-08-24T20:37:38.123+07:00')
  })

  it('pads 1- or 2-digit fractional seconds to milliseconds', () => {
    expect(normalizeDate('2018-08-24T20:37:38.1+07:00'))
      .toBe('2018-08-24T20:37:38.100+07:00')
    expect(normalizeDate('2018-08-24T20:37:38.12+07:00'))
      .toBe('2018-08-24T20:37:38.120+07:00')
  })

  it('produces dates that new Date() can parse', () => {
    // The whole point of this module — every output must be Date-parseable.
    const cases = [
      '2018-08-24 20:37:38.000000000 +07:00',
      '2018-08-24 20:37:38 +0700',
      '2018-08-24T20:37:38+07:00',
      '2024-12-25 00:00:00 +0000',
    ]
    for (const c of cases) {
      const normalized = normalizeDate(c)
      const parsed = new Date(normalized)
      expect(parsed.toString()).not.toBe('Invalid Date')
      expect(Number.isNaN(parsed.getTime())).toBe(false)
    }
  })

  it('returns date-only strings as-is for Date constructor', () => {
    expect(normalizeDate('2018-08-24')).toBe('2018-08-24')
    expect(new Date(normalizeDate('2018-08-24')).toString()).not.toBe('Invalid Date')
  })
})
