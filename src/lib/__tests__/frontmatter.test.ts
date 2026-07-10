import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../frontmatter'

describe('parseFrontmatter', () => {
  it('returns empty frontmatter and full body when no frontmatter block', () => {
    const raw = 'Just some content.\nNo frontmatter here.'
    const { frontmatter, body } = parseFrontmatter(raw)
    expect(frontmatter).toEqual({})
    expect(body).toBe(raw)
  })

  it('parses simple key-value frontmatter', () => {
    const raw = `---
title: Hello World
layout: page
---

Body content.`
    const { frontmatter, body } = parseFrontmatter(raw)
    expect(frontmatter.title).toBe('Hello World')
    expect(frontmatter.layout).toBe('page')
    expect(body.trim()).toBe('Body content.')
  })

  it('parses list values (redirect_from)', () => {
    const raw = `---
title: Test
redirect_from:
  - /old-url/
  - /older-url/
---

Body.`
    const { frontmatter } = parseFrontmatter(raw)
    expect(frontmatter.redirect_from).toEqual(['/old-url/', '/older-url/'])
  })

  it('handles quoted strings', () => {
    const raw = `---
title: "Hello: World"
---

Body.`
    const { frontmatter } = parseFrontmatter(raw)
    expect(frontmatter.title).toBe('Hello: World')
  })

  it('returns empty frontmatter on malformed YAML (no throw)', () => {
    // Truly malformed YAML: unbalanced flow scalar triggers js-yaml parse error.
    const raw = `---
title: [unclosed bracket
---

Body.`
    const { frontmatter, body } = parseFrontmatter(raw)
    expect(frontmatter).toEqual({})
    expect(body).toContain('Body.')
  })

  it('handles empty frontmatter block', () => {
    const raw = `---
---

Body.`
    const { frontmatter, body } = parseFrontmatter(raw)
    expect(frontmatter).toEqual({})
    expect(body.trim()).toBe('Body.')
  })

  it('handles Windows-style line endings in body', () => {
    const raw = '---\r\ntitle: Test\r\n---\r\n\r\nBody.'
    const { frontmatter } = parseFrontmatter(raw)
    expect(frontmatter.title).toBe('Test')
  })
})
