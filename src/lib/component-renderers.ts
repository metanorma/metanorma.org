// Enhanced component renderers for the mirror-renderer.
//
// These override the base node renderers. AsciiDoc authors get richer
// HTML without needing a new content pipeline. Each renderer is a pure
// function that produces component-grade markup styled by global.css.
//
// This module has NO import-time side effects: it exports the
// componentRenderers table, and RenderPipeline composes it explicitly
// ({ ...baseRenderers, ...componentRenderers }) — production output no
// longer depends on module import order.

import { renderNode, type NodeRenderer } from './mirror-renderer'
import { escapeHtml } from './html'

// ── SVG icons ────────────────────────────────────────────────────────

function admonitionIcon(type: string): string {
  const icons: Record<string, string> = {
    note: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1" fill="currentColor"/>',
    tip: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12c1 1 1 2 1 3h6c0-1 0-2 1-3a7 7 0 0 0-4-12z"/>',
    warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill="currentColor"/>',
    important: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/>',
    caution: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    danger: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  }
  const path = icons[type] || icons.note
  return `<svg class="admonition-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
}

// ── Enhanced admonition ──────────────────────────────────────────────

const renderAdmonitionComponent: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const rawType = String(attrs.admonition_type || attrs.type || 'note')
  const admType = rawType.toLowerCase()
  const label = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()
  const icon = admonitionIcon(admType)
  const body = node.content ? node.content.map(c => renderNode(c, ctx)).join('') : ''
  return `<div class="admonition admonition-${escapeHtml(admType)}" data-admonition="${escapeHtml(admType)}"><div class="admonition-header">${icon}<span class="admonition-label">${escapeHtml(label)}</span></div><div class="admonition-body">${body}</div></div>`
}

// ── Enhanced code block ──────────────────────────────────────────────

const renderCodeBlockComponent: NodeRenderer = (node) => {
  const attrs = node.attrs || {}
  const lang = String(attrs.lang || attrs.language || '')
  const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : ''
  const body = attrs.text != null
    ? escapeHtml(String(attrs.text))
    : escapeHtml(node.text || '')
  const titleHtml = attrs.title
    ? `<div class="code-header"><span class="code-filename">${escapeHtml(String(attrs.title))}</span>${lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : ''}</div>`
    : ''
  return `<div class="code-block${attrs.title ? ' code-block--titled' : ''}" data-code-block>${titleHtml}<pre><code${langClass}>${body}</code></pre></div>`
}

// ── Enhanced table ───────────────────────────────────────────────────

const renderTableComponent: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const caption = attrs.title ? `<caption>${escapeHtml(String(attrs.title))}</caption>` : ''
  const head = node.content?.find(c => c.type === 'table_head')
  const body = node.content?.find(c => c.type === 'table_body')
  const headHtml = head
    ? `<thead>${head.content?.map(r => renderNode(r, ctx)).join('') || ''}</thead>`
    : ''
  const bodyHtml = body
    ? `<tbody>${body.content?.map(r => renderNode(r, ctx)).join('') || ''}</tbody>`
    : ''
  return `<div class="table-wrapper"><table>${caption}${headHtml}${bodyHtml}</table></div>`
}

// ── The component renderer table ─────────────────────────────────────
// Overrides for base node types, composed into the production pipeline
// by render-pipeline.ts. Adding a component override = adding one
// entry here.

export const componentRenderers: Record<string, NodeRenderer> = {
  admonition: renderAdmonitionComponent,
  code_block: renderCodeBlockComponent,
  sourcecode: renderCodeBlockComponent,
  table: renderTableComponent,
}
