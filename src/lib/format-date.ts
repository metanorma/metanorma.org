// Shared date formatting for blog post presentation.
//
// Single source of truth for "render a date for the user" — used by
// BlogIndex, HomePage, and any future caller. Returns '' for invalid
// dates (instead of the string "Invalid Date") so consumers can render
// cleanly even when source data is missing or malformed.

import { normalizeDate } from './blog-date'

export function formatDate(date: string): string {
  if (!date) return ''
  const normalized = normalizeDate(date)
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
