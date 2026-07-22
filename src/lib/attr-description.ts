// Tiny AsciiDoc-flavored prose formatter for manifest text fields
// (description / example / values / notes / sections prose).
//
// Deliberately NOT a full AsciiDoc renderer — it covers exactly the
// inline and block constructs that occur in attributes/*.yaml:
//
//   Inline: HTML escaping first, then `code`, *bold*, _italic_,
//           "`-quoted`" smart quotes, link:url[text],
//           https://url[text] shorthand, <url> autolinks,
//           <<anchor,text>> cross-references, [added in URL] macros.
//   Block:  blank-line paragraphs, * / ** bullet lists,
//           [source] ---- fences, [NOTE]/[TIP]/… ==== admonitions
//           (also paragraph-style [NOTE] without a fence),
//           [example] ==== blocks, .Title caption lines, and runs of
//           `:attr: value` attribute-setting lines (rendered as code).
//
// Emitted class names (admonition-*, example-block, code-block) match
// the mirror renderer's output so the existing .mn-rendered CSS styles
// both pipelines identically. Pure string → string: no Astro imports.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Render the inline constructs of a raw (unescaped) text run: HTML is
// escaped FIRST, then the formatting rules run on the escaped string
// (backticks, asterisks, underscores and brackets survive escaping, and
// <<xref>> / <url> constructs are matched in their escaped &lt; form).
// Placeholders (\x00n\x00) protect rendered fragments from later rules.
export function renderInline(raw: string): string {
  const fragments: string[] = []
  const stash = (html: string): string => {
    fragments.push(html)
    return `\x00${fragments.length - 1}\x00`
  }

  let out = escapeHtml(raw)

  // Smart quotes: "`…`" (the form the extractor kept from the source
  // pages) → “…” (must run before the code-span rule — the construct
  // itself contains backticks).
  out = out.replace(/&quot;`([^`]+)`&quot;/g, (_, inner) => stash(`&ldquo;${inner}&rdquo;`))

  // Code spans.
  out = out.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${code}</code>`))

  // link:target[text]. Relative targets (no scheme, not '/' or '#'
  // prefixed) resolve to the sibling page: ../{target}/.
  out = out.replace(/link:([^\s[]+)\[([^\]]*)\]/g, (_, target, text) => {
    const href = /^(?:[a-z]+:)?\/\//i.test(target) || target.startsWith('/') || target.startsWith('#')
      ? target
      : `../${target}/`
    return stash(`<a href="${href}">${text}</a>`)
  })

  // Bare URL macro: https://url[text].
  out = out.replace(/(https?:\/\/[^\s\]]+)\[([^\]]*)\]/g, (_, url, text) =>
    stash(`<a href="${url}" target="_blank" rel="noopener">${text}</a>`))

  // <<anchor,text>> / <<anchor>> cross-references (escaped form).
  out = out.replace(/&lt;&lt;([^,&]+),(.+?)&gt;&gt;/g, (_, anchor, text) =>
    stash(`<a href="#${anchor}">${text}</a>`))
  out = out.replace(/&lt;&lt;([^,&]+)&gt;&gt;/g, (_, anchor) =>
    stash(`<a href="#${anchor}">${anchor}</a>`))

  // <url> autolinks (escaped form).
  out = out.replace(/&lt;(https?:\/\/[^&]+?)&gt;/g, (_, url) =>
    stash(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`))

  // [added in https://github.com/metanorma/<component>/releases/tag/vX] —
  // render as a version chip, the same markup AttrEntry.astro uses for
  // entry-level added_in chips (component from the repo, version from
  // the tag). Non-matching URLs fall back to a compact release link.
  out = out.replace(/\[added in (https?:\/\/[^\]]+)\]/g, (_, url) => {
    const m = url.match(/github\.com\/metanorma\/([^/]+)\/releases\/tag\/([^/?\]]+)/)
    if (!m) {
      const version = url.split('/').pop()
      return stash(`<a class="added-in" href="${url}" target="_blank" rel="noopener">added in ${version}</a>`)
    }
    const [, component, version] = m
    return stash(`<a class="attr-chip attr-chip-version" href="${url}" target="_blank" rel="noopener" title="Added in ${component} ${version}">${component} ≥ ${version}</a>`)
  })

  // [deprecated in https://…/releases/tag/vX] — warning version chip.
  out = out.replace(/\[deprecated in (https?:\/\/[^\]]+)\]/g, (_, url) => {
    const m = url.match(/github\.com\/metanorma\/([^/]+)\/releases\/tag\/([^/?\]]+)/)
    if (!m) {
      const version = url.split('/').pop()
      return stash(`<a class="added-in" href="${url}" target="_blank" rel="noopener">deprecated in ${version}</a>`)
    }
    const [, component, version] = m
    return stash(`<a class="attr-chip attr-chip-warn" href="${url}" target="_blank" rel="noopener" title="Deprecated in ${component} ${version}">deprecated in ${component} ≥ ${version}</a>`)
  })

  // Bold / italic (constrained: not inside words).
  out = out.replace(/(?<![\w*])\*([^*]+)\*(?![\w*])/g, '<strong>$1</strong>')
  out = out.replace(/(?<![\w_])_([^_]+)_(?![\w_])/g, '<em>$1</em>')

  return out.replace(/\x00(\d+)\x00/g, (_, i) => fragments[Number(i)])
}

interface ListItem { depth: number; text: string }

function renderList(items: ListItem[]): string {
  // Nested <ul> by star count; items arrive in document order.
  let html = ''
  const stack: number[] = []
  for (const item of items) {
    while (stack.length && item.depth < stack[stack.length - 1]) {
      html += '</li></ul>'
      stack.pop()
    }
    if (!stack.length || item.depth > stack[stack.length - 1]) {
      html += '<ul>'
      stack.push(item.depth)
    } else {
      html += '</li>'
    }
    html += `<li>${renderInline(item.text)}`
  }
  while (stack.length) {
    html += '</li></ul>'
    stack.pop()
  }
  return html
}

const LIST_LINE = /^(\*{1,5})\s+(.*)$/
const CAPTION_LINE = /^\.(\S.*)$/
const SOURCE_MARKER = /^\[source(?:,[^\]]*)?\]$/
const ADMONITION_MARKER = /^\[(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]$/
const ANCHOR_LINE = /^\[\[([^\]]+)\]\]$/

function renderAdmonition(kind: string, inner: string): string {
  const label = kind.charAt(0) + kind.slice(1).toLowerCase()
  return `<div class="admonition admonition-${kind.toLowerCase()}" data-admonition="${kind.toLowerCase()}">` +
    `<div class="admonition-header"><span class="admonition-label">${label}</span></div>` +
    `<div class="admonition-body">${renderBlocks(inner)}</div></div>`
}

function renderCodeBlock(raw: string): string {
  return `<div class="code-block" data-code-block><pre><code>${escapeHtml(raw.replace(/\n$/, ''))}</code></pre></div>`
}

// Paragraph assembly: join wrapped lines with a space, dropping the
// AsciiDoc hard-break marker (` +`) at line ends.
function renderParagraph(lines: string[]): string {
  const text = lines.map(l => l.replace(/\s+\+$/, '')).join(' ')
  return `<p>${renderInline(text)}</p>`
}

function isBlockStart(line: string): boolean {
  return line === '----' || line === '====' ||
    LIST_LINE.test(line) || CAPTION_LINE.test(line) ||
    SOURCE_MARKER.test(line) || ADMONITION_MARKER.test(line) ||
    ANCHOR_LINE.test(line) ||
    line === '[example]' || line.startsWith(':')
}

// Block-level rendering. `src` is raw (unescaped) manifest prose.
export function renderBlocks(src: string): string {
  const lines = src.replace(/\r/g, '').split('\n')
  const html: string[] = []
  let i = 0

  const peek = (from: number): string | undefined => {
    for (let j = from; j < lines.length; j++) {
      if (lines[j].trim() !== '') return lines[j]
    }
    return undefined
  }

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    // [[anchor]] — emitted as an empty span carrying the id so deep
    // links to it keep working.
    const am = line.match(ANCHOR_LINE)
    if (am) {
      html.push(`<span id="${am[1]}"></span>`)
      i++
      continue
    }

    // [source] marker: applies to the ---- fence that follows.
    if (SOURCE_MARKER.test(line)) { i++; continue }

    // ---- code fence.
    if (line === '----') {
      const body: string[] = []
      i++
      while (i < lines.length && lines[i] !== '----') body.push(lines[i++])
      i++ // closing fence
      html.push(renderCodeBlock(body.join('\n')))
      continue
    }

    // [NOTE]/[TIP]/… — fenced ==== admonition, or paragraph-style.
    const adm = line.match(ADMONITION_MARKER)
    if (adm) {
      if (peek(i + 1) === '====') {
        i++ // marker
        while (i < lines.length && lines[i].trim() === '') i++
        i++ // opening ====
        const body: string[] = []
        while (i < lines.length && lines[i] !== '====') body.push(lines[i++])
        i++ // closing ====
        html.push(renderAdmonition(adm[1], body.join('\n')))
      } else {
        // Paragraph-style: the next paragraph is the admonition body.
        i++
        const body: string[] = []
        while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) body.push(lines[i++])
        html.push(renderAdmonition(adm[1], body.join('\n')))
      }
      continue
    }

    // [example] (or bare ====) example block.
    if (line === '[example]' || line === '====') {
      if (line === '[example]' && peek(i + 1) !== '====') { i++; continue }
      if (line === '[example]') {
        i++
        while (i < lines.length && lines[i].trim() === '') i++
      }
      i++ // opening ====
      const body: string[] = []
      while (i < lines.length && lines[i] !== '====') body.push(lines[i++])
      i++ // closing ====
      html.push(`<div class="example-block"><div class="example-label">Example</div>${renderBlocks(body.join('\n'))}</div>`)
      continue
    }

    // Bullet list (consecutive list lines, any depth).
    const lm = line.match(LIST_LINE)
    if (lm) {
      const items: ListItem[] = []
      while (i < lines.length) {
        const m = lines[i].match(LIST_LINE)
        if (!m) break
        items.push({ depth: m[1].length, text: m[2] })
        i++
      }
      html.push(renderList(items))
      continue
    }

    // .Title caption.
    const cm = line.match(CAPTION_LINE)
    if (cm) {
      html.push(`<div class="block-title">${renderInline(cm[1])}</div>`)
      i++
      continue
    }

    // Run of `:attr: value` attribute-setting lines → code block.
    if (line.startsWith(':')) {
      const body: string[] = []
      while (i < lines.length && lines[i].startsWith(':')) body.push(lines[i++])
      html.push(renderCodeBlock(body.join('\n')))
      continue
    }

    // Paragraph.
    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      para.push(lines[i++])
    }
    html.push(renderParagraph(para))
  }

  return html.join('')
}

// The one entry point used by the component: full prose → HTML.
export function renderDescription(src: string): string {
  return renderBlocks(src)
}
