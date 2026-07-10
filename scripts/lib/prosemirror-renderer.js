function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderMarksOpen(marks) {
  if (!marks || marks.length === 0) return ''
  return marks.map(m => {
    switch (m.type) {
      case 'bold': return '<strong>'
      case 'italic': return '<em>'
      case 'code': return '<code>'
      case 'link': return `<a href="${escapeHtml(m.attrs?.href || '#')}"${m.attrs?.href?.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>`
      case 'xref': return `<a href="${escapeHtml(m.attrs?.target || '#')}">`
      case 'underline': return '<u>'
      case 'strikethrough': return '<s>'
      case 'subscript': return '<sub>'
      case 'superscript': return '<sup>'
      case 'highlight': return '<mark>'
      case 'stem': return '<span class="stem">'
      case 'span': return `<span class="${escapeHtml(m.attrs?.role || '')}">`
      default: return '<span>'
    }
  }).join('')
}

function renderMarksClose(marks) {
  if (!marks || marks.length === 0) return ''
  return [...marks].reverse().map(m => {
    switch (m.type) {
      case 'bold': return '</strong>'
      case 'italic': return '</em>'
      case 'code': return '</code>'
      case 'link': return '</a>'
      case 'xref': return '</a>'
      case 'underline': return '</u>'
      case 'strikethrough': return '</s>'
      case 'subscript': return '</sub>'
      case 'superscript': return '</sup>'
      case 'highlight': return '</mark>'
      case 'stem': return '</span>'
      case 'span': return '</span>'
      default: return '</span>'
    }
  }).join('')
}

function renderNode(node) {
  const children = node.content ? node.content.map(renderNode).join('') : ''
  const attrs = node.attrs || {}

  switch (node.type) {
    case 'doc': return children
    case 'paragraph': return `<p>${children}</p>`
    case 'heading': {
      const level = attrs.level || 1
      const id = attrs.id ? ` id="${escapeHtml(attrs.id)}"` : ''
      return `<h${level}${id}>${children}</h${level}>`
    }
    case 'text':
      return `${renderMarksOpen(node.marks)}${escapeHtml(node.text || '')}${renderMarksClose(node.marks)}`
    case 'code_block': {
      const lang = attrs.lang || attrs.language || ''
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      return `<pre><code${langClass}>${escapeHtml(node.text || children)}</code></pre>`
    }
    case 'blockquote': return `<blockquote>${children}</blockquote>`
    case 'example':
      return `<div class="example-block"><div class="example-label">${attrs.title ? escapeHtml(attrs.title) : 'Example'}</div>${children}</div>`
    case 'sidebar': return `<div class="sidebar-block">${children}</div>`
    case 'open_block': return `<div class="open-block">${children}</div>`
    case 'verse': return `<div class="verse-block"><pre>${children}</pre></div>`
    case 'bullet_list': return `<ul>${children}</ul>`
    case 'ordered_list': return `<ol>${children}</ol>`
    case 'list_item': return `<li>${children}</li>`
    case 'definition_list': return `<dl>${children}</dl>`
    case 'definition_term': return `<dt>${children}</dt>`
    case 'definition_description': return `<dd>${children}</dd>`
    case 'table': {
      const head = node.content?.find(c => c.type === 'table_head')
      const body = node.content?.find(c => c.type === 'table_body')
      const headHtml = head ? `<thead>${head.content?.map(r => renderNode(r)).join('') || ''}</thead>` : ''
      const bodyHtml = body ? `<tbody>${body.content?.map(r => renderNode(r)).join('') || ''}</tbody>` : ''
      return `<table>${headHtml}${bodyHtml}</table>`
    }
    case 'table_row': return `<tr>${children}</tr>`
    case 'table_cell': {
      const tag = attrs.header ? 'th' : 'td'
      const colspan = attrs.colspan ? ` colspan="${attrs.colspan}"` : ''
      const rowspan = attrs.rowspan ? ` rowspan="${attrs.rowspan}"` : ''
      return `<${tag}${colspan}${rowspan}>${children}</${tag}>`
    }
    case 'image': {
      const src = attrs.src || ''
      const alt = attrs.alt || ''
      const title = attrs.title ? ` title="${escapeHtml(attrs.title)}"` : ''
      return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${title} loading="lazy" />${attrs.caption ? `<figcaption>${escapeHtml(attrs.caption)}</figcaption>` : ''}</figure>`
    }
    case 'admonition': {
      const admType = attrs.admonition_type || attrs.type || 'note'
      return `<div class="admonition admonition-${admType}"><div class="admonition-label">${admType.charAt(0).toUpperCase() + admType.slice(1)}</div>${children}</div>`
    }
    case 'section': {
      const id = attrs.id ? ` id="${escapeHtml(attrs.id)}"` : ''
      return `<section${id}>${children}</section>`
    }
    case 'preamble': return children
    case 'header': {
      const level = attrs.level || 1
      const id = attrs.id ? ` id="${escapeHtml(attrs.id)}"` : ''
      return `<h${level}${id}>${escapeHtml(attrs.title || '')}</h${level}>`
    }
    case 'bibliography': return `<div class="bibliography">${children}</div>`
    case 'biblio_entry': return `<div class="biblio-entry">${children}</div>`
    case 'footnotes': return `<div class="footnotes">${children}</div>`
    case 'footnote_marker':
      return `<sup class="footnote-marker"><a href="#${escapeHtml(attrs.id || '')}" id="${escapeHtml(attrs.ref_id || '')}">${attrs.number || '*'}</a></sup>`
    case 'footnote_entry':
      return `<div class="footnote-entry" id="${escapeHtml(attrs.id || '')}"><sup>${attrs.number || '*'}</sup> ${children}</div>`
    case 'toc': return '<nav class="toc"></nav>'
    case 'horizontal_rule': return '<hr>'
    case 'soft_break': return '<br>'
    case 'comment': return ''
    case 'reviewer': return `<div class="reviewer-comment">${children}</div>`
    default: return children || escapeHtml(node.text || '')
  }
}

export function renderProseMirrorToHtml(doc) {
  if (typeof doc === 'string') {
    try { doc = JSON.parse(doc) } catch { return '' }
  }
  return renderNode(doc)
}
