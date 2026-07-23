import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock execSync so lastmodFor tests don't depend on real git state.
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

import { editUrlFor, lastmodFor, REPO_EDIT_BASE } from '../source-meta'
import { execSync } from 'node:child_process'

const mockExec = execSync as unknown as ReturnType<typeof vi.fn>

describe('editUrlFor', () => {
  it('builds a GitHub edit URL for a source path', () => {
    expect(editUrlFor('author/basics/asciidoc.adoc'))
      .toBe(REPO_EDIT_BASE + 'author/basics/asciidoc.adoc')
  })

  it('strips a leading slash so the URL is clean', () => {
    expect(editUrlFor('/author/basics/asciidoc.adoc'))
      .toBe(REPO_EDIT_BASE + 'author/basics/asciidoc.adoc')
  })

  it('strips multiple leading slashes', () => {
    expect(editUrlFor('///author/index.adoc'))
      .toBe(REPO_EDIT_BASE + 'author/index.adoc')
  })

  it('handles underscore-prefixed paths (_pages, _posts)', () => {
    expect(editUrlFor('_pages/author.adoc'))
      .toBe(REPO_EDIT_BASE + '_pages/author.adoc')
  })

  it('returns null for empty / null / undefined input', () => {
    expect(editUrlFor('')).toBeNull()
    expect(editUrlFor(null)).toBeNull()
    expect(editUrlFor(undefined)).toBeNull()
  })
})

describe('lastmodFor', () => {
  beforeEach(() => {
    mockExec.mockReset()
  })

  it('returns null for empty / null / undefined input without invoking git', () => {
    expect(lastmodFor('')).toBeNull()
    expect(lastmodFor(null)).toBeNull()
    expect(lastmodFor(undefined)).toBeNull()
    expect(mockExec).not.toHaveBeenCalled()
  })

  it('parses a valid ISO timestamp from git log', () => {
    mockExec.mockReturnValueOnce('2025-07-21T16:19:19+00:00\n')
    expect(lastmodFor('author/index.adoc')).toBe('2025-07-21T16:19:19+00:00')
    // Single-arg call with the path quoted for shell safety.
    expect(mockExec).toHaveBeenCalledTimes(1)
    const [cmd] = mockExec.mock.calls[0]
    expect(cmd).toContain('git log -1')
    expect(cmd).toContain('"author/index.adoc"')
  })

  it('returns null when git rejects the path (file not tracked)', () => {
    mockExec.mockImplementationOnce(() => { throw new Error('exit 128') })
    expect(lastmodFor('nonexistent.adoc')).toBeNull()
  })

  it('returns null when git emits a non-date string', () => {
    mockExec.mockReturnValueOnce('not a date\n')
    expect(lastmodFor('weird.adoc')).toBeNull()
  })

  it('caches the result so subsequent calls do not re-invoke git', () => {
    mockExec.mockReturnValueOnce('2025-07-21T16:19:19+00:00\n')
    lastmodFor('cached.adoc')
    lastmodFor('cached.adoc')
    lastmodFor('cached.adoc')
    expect(mockExec).toHaveBeenCalledTimes(1)
  })
})
