// Renderer registry: each Mirror node type maps to a renderer function.
// Adding a new type = adding one entry to the map. The dispatcher does
// a single lookup; falls back to children-or-text for unknown types.
//
// All renderers are pure functions of (node, ctx) → string. Shared
// helpers (escapeHtml, slugify, resolveHeadingId) live at top-level.

export interface Mark {
  type: string
  attrs?: Record<string, string>
}

export interface MirrorNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  content?: MirrorNode[]
  marks?: Mark[]
}

export interface HeadingRef {
  depth: number
  slug: string
  text: string
}

export interface RenderContext {
  seenIds: Set<string>
  headings: HeadingRef[]
  // Renderer table for this render. When absent, renderNode dispatches
  // through the module-level baseRenderers registry (the public
  // registerNodeRenderer extension point). RenderPipeline passes its
  // explicitly composed table here.
  renderers?: Record<string, NodeRenderer>
  // Trimmed page title to strip a duplicate first heading for (see
  // recordHeading). Undefined = no stripping.
  stripTitle?: string
  // Set once the first recordable heading has been considered as a
  // strip candidate — only that first heading can be stripped.
  stripCandidateSeen?: boolean
}

export type NodeRenderer = (node: MirrorNode, ctx: RenderContext) => string

export interface MarkHandler {
  open: (attrs?: Record<string, string>) => string
  close: () => string
}

import { sectionLevelToHeadingLevel } from './heading-levels'
import { escapeHtml } from './html'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractText(node: MirrorNode): string {
  if (!node) return ''
  if (node.text) return node.text
  if (node.attrs?.title) return String(node.attrs.title)
  if (node.content) return node.content.map(extractText).join('')
  return ''
}

function uniqueId(base: string, ctx: RenderContext): string {
  if (!base) return ''
  let id = base
  let i = 2
  while (ctx.seenIds.has(id)) {
    id = `${base}-${i++}`
  }
  ctx.seenIds.add(id)
  return id
}

function resolveHeadingId(attrs: Record<string, unknown>, fallbackText: string, ctx: RenderContext): string {
  const explicit = attrs.id ? String(attrs.id) : ''
  if (explicit) {
    ctx.seenIds.add(explicit)
    return explicit
  }
  return uniqueId(slugify(fallbackText), ctx)
}

// Records a heading in the TOC list. Returns true when the heading was
// STRIPPED instead: when a strip title is set, the first recordable
// heading (depth 2-4 with an id) whose text matches it is dropped from
// both the headings array and (by the callers below) the emitted HTML.
// This replaces the old indexOf/substring HTML surgery in the loader,
// which dropped headings[0] even when the HTML strip itself did not
// fire — the renderer knows the first heading when it emits it.
function recordHeading(depth: number, id: string, node: MirrorNode, ctx: RenderContext): boolean {
  if (depth < 2 || depth > 4 || !id) return false
  const text = extractText(node)
  if (!ctx.stripCandidateSeen) {
    ctx.stripCandidateSeen = true
    if (ctx.stripTitle !== undefined && text.trim() === ctx.stripTitle) {
      return true
    }
  }
  ctx.headings.push({ depth, slug: id, text })
  return false
}

function xrefHref(target: string | undefined): string {
  const t = target || ''
  if (!t) return '#'
  if (/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(t)) return `#${t}`
  return t
}

// ── Mark handler registry ─────────────────────────────────────────────
// Table-driven: each mark type maps to { open, close }. Adding a mark
// = adding one entry. No dual switches to keep in sync.

const wrap = (open: string, close: string): MarkHandler => ({
  open: () => open,
  close: () => close,
})

const markHandlers: Record<string, MarkHandler> = {
  bold: wrap('<strong>', '</strong>'),
  strong: wrap('<strong>', '</strong>'),
  italic: wrap('<em>', '</em>'),
  emphasis: wrap('<em>', '</em>'),
  code: wrap('<code>', '</code>'),
  link: {
    open: (attrs) => {
      const href = escapeHtml(attrs?.href || '#')
      const external = attrs?.href?.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
      return `<a href="${href}"${external}>`
    },
    close: () => '</a>',
  },
  xref: {
    open: (attrs) => `<a href="${escapeHtml(xrefHref(attrs?.target))}">`,
    close: () => '</a>',
  },
  underline: wrap('<u>', '</u>'),
  strikethrough: wrap('<s>', '</s>'),
  subscript: wrap('<sub>', '</sub>'),
  superscript: wrap('<sup>', '</sup>'),
  highlight: wrap('<mark>', '</mark>'),
  stem: wrap('<span class="stem">', '</span>'),
  span: {
    open: (attrs) => `<span class="${escapeHtml(attrs?.role || '')}">`,
    close: () => '</span>',
  },
}

function renderMarksOpen(marks?: Mark[]): string {
  if (!marks || marks.length === 0) return ''
  return marks.map(m => {
    const handler = markHandlers[m.type]
    return handler ? handler.open(m.attrs) : '<span>'
  }).join('')
}

function renderMarksClose(marks?: Mark[]): string {
  if (!marks || marks.length === 0) return ''
  return [...marks].reverse().map(m => {
    const handler = markHandlers[m.type]
    return handler ? handler.close() : '</span>'
  }).join('')
}

function renderChildren(node: MirrorNode, ctx: RenderContext): string {
  return node.content ? node.content.map(c => renderNode(c, ctx)).join('') : ''
}

// ── Renderer functions ────────────────────────────────────────────────
// One per node type. Each is a pure (node, ctx) → string. Tests can
// target any individual renderer via the registry.

const renderChildrenOnly: NodeRenderer = (node, ctx) => renderChildren(node, ctx)

const renderDoc: NodeRenderer = (node, ctx) => renderChildren(node, ctx)

const renderParagraph: NodeRenderer = (node, ctx) => `<p>${renderChildren(node, ctx)}</p>`

const renderText: NodeRenderer = (node) =>
  `${renderMarksOpen(node.marks)}${escapeHtml(node.text || '')}${renderMarksClose(node.marks)}`

const renderHeading: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const level = (attrs.level as number) || 1
  const id = resolveHeadingId(attrs, extractText(node), ctx)
  if (recordHeading(level, id, node, ctx)) return ''
  return `<h${level}${id ? ` id="${escapeHtml(id)}"` : ''}>${renderChildren(node, ctx)}</h${level}>`
}

const renderCodeBlock: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const lang = (attrs.lang as string) || (attrs.language as string) || ''
  const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : ''
  const title = attrs.title ? `<div class="code-title">${escapeHtml(String(attrs.title))}</div>` : ''
  const body = attrs.text != null
    ? escapeHtml(String(attrs.text))
    : escapeHtml(node.text || '') || renderChildren(node, ctx)
  return `${title}<pre><code${langClass}>${body}</code></pre>`
}

const renderBlockquote: NodeRenderer = (node, ctx) => `<blockquote>${renderChildren(node, ctx)}</blockquote>`

const renderExample: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  return `<div class="example-block"><div class="example-label">${escapeHtml(String(attrs.title || 'Example'))}</div>${renderChildren(node, ctx)}</div>`
}

const renderSidebar: NodeRenderer = (node, ctx) => `<div class="sidebar-block">${renderChildren(node, ctx)}</div>`
const renderOpenBlock: NodeRenderer = (node, ctx) => `<div class="open-block">${renderChildren(node, ctx)}</div>`
const renderVerse: NodeRenderer = (node, ctx) => `<div class="verse-block"><pre>${renderChildren(node, ctx)}</pre></div>`
const renderBulletList: NodeRenderer = (node, ctx) => `<ul>${renderChildren(node, ctx)}</ul>`
const renderOrderedList: NodeRenderer = (node, ctx) => `<ol>${renderChildren(node, ctx)}</ol>`
const renderListItem: NodeRenderer = (node, ctx) => `<li>${renderChildren(node, ctx)}</li>`
const renderDl: NodeRenderer = (node, ctx) => `<dl>${renderChildren(node, ctx)}</dl>`
const renderDt: NodeRenderer = (node, ctx) => `<dt>${renderChildren(node, ctx)}</dt>`
const renderDd: NodeRenderer = (node, ctx) => `<dd>${renderChildren(node, ctx)}</dd>`

// Clause / annex / references share a section-with-heading template.
// Level is offset by 1 (page title takes h1). Title becomes the
// section's heading; body children render after.
const renderSectionLike: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const level = sectionLevelToHeadingLevel(attrs.level as number)
  const id = resolveHeadingId(attrs, String(attrs.title || ''), ctx)
  const stripped = attrs.title ? recordHeading(level, id, node, ctx) : false
  const heading = attrs.title && !stripped
    ? `<h${level}${id ? ` id="${escapeHtml(id)}"` : ''}>${escapeHtml(String(attrs.title))}</h${level}>`
    : ''
  return `<section${id ? ` id="${escapeHtml(id)}"` : ''}>${heading}${renderChildren(node, ctx)}</section>`
}

const renderTable: NodeRenderer = (node, ctx) => {
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
  return `<table>${caption}${headHtml}${bodyHtml}</table>`
}

const renderTableRow: NodeRenderer = (node, ctx) => `<tr>${renderChildren(node, ctx)}</tr>`

const renderTableCell: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const tag = attrs.header ? 'th' : 'td'
  const colspan = attrs.colspan ? ` colspan="${escapeHtml(String(attrs.colspan))}"` : ''
  const rowspan = attrs.rowspan ? ` rowspan="${escapeHtml(String(attrs.rowspan))}"` : ''
  return `<${tag}${colspan}${rowspan}>${renderChildren(node, ctx)}</${tag}>`
}

const renderImage: NodeRenderer = (node) => {
  const attrs = node.attrs || {}
  const src = (attrs.src as string) || ''
  const alt = (attrs.alt as string) || ''
  const title = attrs.title ? ` title="${escapeHtml(String(attrs.title))}"` : ''
  const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${title} loading="lazy" decoding="async" />`
  if (attrs.caption) {
    return `<figure>${img}<figcaption>${escapeHtml(String(attrs.caption))}</figcaption></figure>`
  }
  return img
}

const renderFigure: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const caption = node.content?.find(c => c.type === 'caption')
  const captionHtml = caption
    ? `<figcaption>${caption.content?.map(c => renderNode(c, ctx)).join('') || ''}</figcaption>`
    : (attrs.title ? `<figcaption>${escapeHtml(String(attrs.title))}</figcaption>` : '')
  const inner = (node.content || []).filter(c => c.type !== 'caption').map(c => renderNode(c, ctx)).join('')
  return `<figure>${inner}${captionHtml}</figure>`
}

const renderCaption: NodeRenderer = () => ''

const renderAdmonition: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const admType = (attrs.admonition_type as string) || (attrs.type as string) || 'note'
  return `<div class="admonition admonition-${escapeHtml(admType)}"><div class="admonition-label">${escapeHtml(admType.charAt(0).toUpperCase() + admType.slice(1))}</div>${renderChildren(node, ctx)}</div>`
}

const renderSection: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const id = resolveHeadingId(attrs, '', ctx)
  return `<section${id ? ` id="${escapeHtml(id)}"` : ''}>${renderChildren(node, ctx)}</section>`
}

const renderHeader: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const level = (attrs.level as number) || 1
  const id = resolveHeadingId(attrs, String(attrs.title || ''), ctx)
  return `<h${level}${id ? ` id="${escapeHtml(id)}"` : ''}>${escapeHtml(String(attrs.title || ''))}</h${level}>`
}

const renderFloatingTitle: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  const level = sectionLevelToHeadingLevel(attrs.level as number)
  const title = String(attrs.title || '')
  const id = resolveHeadingId(attrs, title, ctx)
  if (recordHeading(level, id, node, ctx)) return ''
  return `<h${level}${id ? ` id="${escapeHtml(id)}"` : ''}>${escapeHtml(title)}</h${level}>`
}

const renderPass: NodeRenderer = (node) => {
  const attrs = node.attrs || {}
  if (node.content) {
    return node.content.map(c => String(c.text || '')).join('')
  }
  return String(attrs.text || '')
}

const renderLiteral: NodeRenderer = (node) => {
  const attrs = node.attrs || {}
  return `<pre class="literal-block">${escapeHtml(String(attrs.text || ''))}</pre>`
}

const renderStem: NodeRenderer = (node) => {
  const attrs = node.attrs || {}
  const lang = String(attrs.language || 'latex')
  const text = String(attrs.text || '')
  return `<div class="math math-${escapeHtml(lang)}" data-language="${escapeHtml(lang)}">${escapeHtml(text)}</div>`
}

const renderBibliography: NodeRenderer = (node, ctx) => `<div class="bibliography">${renderChildren(node, ctx)}</div>`
const renderBiblioEntry: NodeRenderer = (node, ctx) => `<div class="biblio-entry">${renderChildren(node, ctx)}</div>`
const renderFootnotes: NodeRenderer = (node, ctx) => `<div class="footnotes">${renderChildren(node, ctx)}</div>`

const renderFootnoteMarker: NodeRenderer = (node) => {
  const attrs = node.attrs || {}
  return `<sup class="footnote-marker"><a href="#${escapeHtml(String(attrs.id || ''))}" id="${escapeHtml(String(attrs.ref_id || ''))}">${attrs.number || '*'}</a></sup>`
}

const renderFootnoteEntry: NodeRenderer = (node, ctx) => {
  const attrs = node.attrs || {}
  return `<div class="footnote-entry" id="${escapeHtml(String(attrs.id || ''))}"><sup>${attrs.number || '*'}</sup> ${renderChildren(node, ctx)}</div>`
}

const renderToc: NodeRenderer = () => '<nav class="toc"></nav>'
const renderHorizontalRule: NodeRenderer = () => '<hr>'
const renderSoftBreak: NodeRenderer = () => '<br>'
const renderComment: NodeRenderer = () => ''
const renderReviewer: NodeRenderer = (node, ctx) => `<div class="reviewer-comment">${renderChildren(node, ctx)}</div>`
const renderRawInline: NodeRenderer = (node) => String(node.text || '')

const renderDefault: NodeRenderer = (node, ctx) =>
  renderChildren(node, ctx) || escapeHtml(node.text || '')

// ── Registry ─────────────────────────────────────────────────────────
// Single source of truth for type → renderer. Multiple types can alias
// the same renderer (e.g., clause/annex/references share renderSectionLike).
// Adding a new type = adding one entry here.
//
// Exported as baseRenderers so RenderPipeline can compose its own table
// explicitly ({ ...baseRenderers, ...componentRenderers }) instead of
// relying on import-time registration side effects.

export const baseRenderers: Record<string, NodeRenderer> = {
  doc: renderDoc,
  frontmatter: () => '',
  sections: renderChildrenOnly,
  preface: renderChildrenOnly,
  generic_block: renderChildrenOnly,
  preamble: renderChildrenOnly,
  paragraph: renderParagraph,
  heading: renderHeading,
  text: renderText,
  code_block: renderCodeBlock,
  sourcecode: renderCodeBlock,
  blockquote: renderBlockquote,
  quote: renderBlockquote,
  example: renderExample,
  sidebar: renderSidebar,
  open_block: renderOpenBlock,
  verse: renderVerse,
  bullet_list: renderBulletList,
  ordered_list: renderOrderedList,
  list_item: renderListItem,
  definition_list: renderDl,
  dl: renderDl,
  definition_term: renderDt,
  dt: renderDt,
  definition_description: renderDd,
  dd: renderDd,
  clause: renderSectionLike,
  annex: renderSectionLike,
  references: renderSectionLike,
  table: renderTable,
  table_row: renderTableRow,
  table_cell: renderTableCell,
  image: renderImage,
  figure: renderFigure,
  caption: renderCaption,
  admonition: renderAdmonition,
  section: renderSection,
  header: renderHeader,
  floating_title: renderFloatingTitle,
  pass: renderPass,
  literal: renderLiteral,
  stem: renderStem,
  bibliography: renderBibliography,
  biblio_entry: renderBiblioEntry,
  footnotes: renderFootnotes,
  footnote_marker: renderFootnoteMarker,
  footnote_entry: renderFootnoteEntry,
  toc: renderToc,
  horizontal_rule: renderHorizontalRule,
  soft_break: renderSoftBreak,
  comment: renderComment,
  reviewer: renderReviewer,
  raw_inline: renderRawInline,
}

export function renderNode(node: MirrorNode, ctx: RenderContext): string {
  if (!node || typeof node.type !== 'string') return ''
  const table = ctx.renderers ?? baseRenderers
  const renderer = table[node.type] ?? renderDefault
  return renderer(node, ctx)
}

export function renderMirrorToHtml(doc: MirrorNode | string, options: RenderMirrorOptions = {}): string {
  return renderMirrorWithHeadings(doc, options).html
}

export interface RenderMirrorOptions {
  // Renderer table to dispatch through for this render (default:
  // the module-level baseRenderers registry).
  renderers?: Record<string, NodeRenderer>
  // When set (and non-empty), the first recorded heading whose text
  // matches this title (trimmed) is stripped from both the HTML and
  // the headings array — the renderer-level duplicate-title strip.
  stripFirstHeadingIf?: string
}

export function renderMirrorWithHeadings(doc: MirrorNode | string, options: RenderMirrorOptions = {}): { html: string; headings: HeadingRef[] } {
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc) as MirrorNode
    } catch {
      return { html: '', headings: [] }
    }
  }
  const ctx: RenderContext = { seenIds: new Set(), headings: [] }
  if (options.renderers) ctx.renderers = options.renderers
  if (options.stripFirstHeadingIf) ctx.stripTitle = options.stripFirstHeadingIf.trim()
  const html = renderNode(doc, ctx)
  return { html, headings: ctx.headings }
}

// Public extension API (OCP: extend without modifying the dispatch
// table above). Registration mutates baseRenderers, so it affects
// renderMirrorToHtml/renderMirrorWithHeadings callers that do not pass
// an explicit table. RenderPipeline composes its own table at
// construction time and is therefore NOT affected by later
// registration — pass custom renderers to its constructor instead.
export function registerNodeRenderer(type: string, renderer: NodeRenderer): void {
  baseRenderers[type] = renderer
}

export function lookupNodeRenderer(type: string): NodeRenderer | undefined {
  return baseRenderers[type]
}
