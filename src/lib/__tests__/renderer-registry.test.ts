import { describe, expect, it } from 'vitest'
import {
  renderNode,
  renderMirrorToHtml,
  registerNodeRenderer,
  lookupNodeRenderer,
  type MirrorNode,
  type RenderContext,
} from '../mirror-renderer'

describe('node renderer registry', () => {
  it('lookupNodeRenderer returns registered renderer for known type', () => {
    expect(lookupNodeRenderer('paragraph')).toBeDefined()
    expect(lookupNodeRenderer('clause')).toBeDefined()
    expect(lookupNodeRenderer('nonexistent_type')).toBeUndefined()
  })

  it('renderNode falls back to default (children-or-text) for unknown types', () => {
    const ctx: RenderContext = { seenIds: new Set(), headings: [] }
    const node: MirrorNode = {
      type: 'mystery_type',
      content: [{ type: 'text', text: 'x' }],
    }
    expect(renderNode(node, ctx)).toBe('x')
  })

  it('renderNode falls back to escaped text for unknown leaf', () => {
    const ctx: RenderContext = { seenIds: new Set(), headings: [] }
    const node: MirrorNode = { type: 'mystery', text: '<a>' }
    expect(renderNode(node, ctx)).toBe('&lt;a&gt;')
  })

  it('registerNodeRenderer overrides an existing renderer', () => {
    const original = lookupNodeRenderer('paragraph')
    expect(original).toBeDefined()

    try {
      registerNodeRenderer('paragraph', () => '<p class="custom">CUSTOM</p>')
      expect(renderMirrorToHtml({ type: 'paragraph', content: [] }))
        .toBe('<p class="custom">CUSTOM</p>')
    } finally {
      // Restore original so other tests aren't affected.
      if (original) registerNodeRenderer('paragraph', original)
    }
  })

  it('registerNodeRenderer adds a new type', () => {
    const custom: MirrorNode = { type: 'custom_block', text: 'hello' }
    // Before registration: falls back to escaped text.
    expect(renderMirrorToHtml(custom)).toBe('hello')

    try {
      registerNodeRenderer('custom_block', (node) => `<div class="custom">${node.text}</div>`)
      expect(renderMirrorToHtml(custom)).toBe('<div class="custom">hello</div>')
    } finally {
      // No original to restore — leave registered (test isolation OK since
      // vitest runs tests in fresh module contexts per file).
    }
  })

  it('multiple types alias the same renderer (clause/annex/references)', () => {
    const clause = lookupNodeRenderer('clause')
    const annex = lookupNodeRenderer('annex')
    const references = lookupNodeRenderer('references')
    expect(clause).toBe(annex)
    expect(annex).toBe(references)
  })

  it('dl/dt/dd short aliases share renderers with full names', () => {
    expect(lookupNodeRenderer('dl')).toBe(lookupNodeRenderer('definition_list'))
    expect(lookupNodeRenderer('dt')).toBe(lookupNodeRenderer('definition_term'))
    expect(lookupNodeRenderer('dd')).toBe(lookupNodeRenderer('definition_description'))
  })
})
