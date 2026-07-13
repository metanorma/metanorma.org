// Date normalization for blog posts.
//
// Source `.adoc` files use Jekyll/Ruby-style date formats in frontmatter:
//   2018-08-24 20:37:38 +0700            (Ruby Time#to_s)
//   2018-08-24 20:37:38.000000000 +07:00 (Ruby Time#iso8601 with ns)
//   2018-08-24T20:37:38+07:00            (clean ISO 8601)
//
// JavaScript's `new Date(str)` only reliably parses ISO 8601 with 'T'
// between date and time. The space-separated forms return Invalid Date.
// This module normalizes all known forms to ISO 8601 so downstream
// `new Date()` and `toLocaleDateString()` work.

const SPACE_SEPARATED_WITH_OFFSET = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*([+-]\d{2}):?(\d{2})$/
const SPACE_SEPARATED_NO_OFFSET = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/

export function normalizeDate(raw: unknown): string {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s) return ''

  // Already ISO 8601 (with 'T').
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return truncateNanoseconds(s)

  // "YYYY-MM-DD HH:MM:SS[.nnnnnnnnn] [+HH[:MM]]" — Ruby/Jekyll form.
  const withOffset = s.match(SPACE_SEPARATED_WITH_OFFSET)
  if (withOffset) {
    const [, date, time, oh, om] = withOffset
    return truncateNanoseconds(`${date}T${time}${oh}:${om}`)
  }

  const noOffset = s.match(SPACE_SEPARATED_NO_OFFSET)
  if (noOffset) {
    const [, date, time] = noOffset
    return truncateNanoseconds(`${date}T${time}`)
  }

  // Date-only or other — return as-is, let Date constructor try.
  return s
}

// JS Date only accepts up to milliseconds (3 digits) in the fractional
// seconds part. Strip excess digits (nanoseconds) and pad short ones so
// the ISO string is always .NNN.
function truncateNanoseconds(iso: string): string {
  return iso.replace(/\.(\d{1,9})(?=[^0-9]|$)/, (_, digits: string) => {
    const ms = digits.slice(0, 3).padEnd(3, '0')
    return '.' + ms
  })
}
