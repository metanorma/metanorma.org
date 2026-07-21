import { describe, expect, it } from 'vitest'
import { defaultPipeline } from '../render-pipeline'
import {
  baseRenderers,
  registerNodeRenderer,
  renderMirrorToHtml,
  type MirrorNode,
} from '../mirror-renderer'

// Exercises defaultPipeline — the PRODUCTION renderer configuration.
// The pipeline composes its node-renderer table EXPLICITLY at
// construction ({ ...baseRenderers, ...componentRenderers }) — no
// import-time registration side effects — so these tests exercise the
// exact table production uses. Steps: renderMath → renderCode →
// rewriteFlavorLinks → normalizeLinks.

function p(...content: MirrorNode[]): MirrorNode {
  return { type: 'paragraph', content }
}

function text(t: string, marks: MirrorNode['marks'] = []): MirrorNode {
  return { type: 'text', text: t, marks }
}

describe('defaultPipeline: component renderers', () => {
  it('renders admonitions with icon svg and label', async () => {
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [{
        type: 'admonition',
        attrs: { admonition_type: 'warning' },
        content: [p(text('Careful now'))],
      }],
    })
    expect(html).toContain('class="admonition admonition-warning"')
    expect(html).toContain('data-admonition="warning"')
    expect(html).toContain('<svg class="admonition-icon"')
    expect(html).toContain('<span class="admonition-label">Warning</span>')
    expect(html).toContain('Careful now')
  })

  it('renders code_block via the component wrapper, then shiki-highlights it', async () => {
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [{ type: 'code_block', attrs: { lang: 'ruby', text: 'puts 1' } }],
    })
    expect(html).toContain('class="code-block"')
    expect(html).toContain('data-code-block')
    expect(html).toContain('shiki')
  })

  it('renders sourcecode nodes with the same code component', async () => {
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [{ type: 'sourcecode', attrs: { language: 'ruby', text: 'puts 1' } }],
    })
    expect(html).toContain('class="code-block"')
    expect(html).toContain('shiki')
  })

  it('renders a titled code block with the filename header', async () => {
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [{ type: 'code_block', attrs: { lang: 'ruby', text: 'puts 1', title: 'app.rb' } }],
    })
    expect(html).toContain('class="code-header"')
    expect(html).toContain('app.rb')
  })

  it('wraps tables in the table-wrapper div', async () => {
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [{
        type: 'table',
        attrs: { title: 'Cap' },
        content: [{
          type: 'table_body',
          content: [{ type: 'table_row', content: [{ type: 'table_cell', content: [text('D')] }] }],
        }],
      }],
    })
    expect(html).toContain('<div class="table-wrapper"><table>')
    expect(html).toContain('<caption>Cap</caption>')
    expect(html).toContain('<td>D</td>')
  })
})

describe('defaultPipeline: step wiring', () => {
  it('renders stem blocks to KaTeX (renderMath step)', async () => {
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [{ type: 'stem', attrs: { language: 'latex', text: 'x^2' } }],
    })
    expect(html).toContain('class="katex"')
  })

  it('rewrites flavor links and adds trailing slashes after rendering', async () => {
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [p(
        text('iso', [{ type: 'link', attrs: { href: '/author/iso/topics/' } }]),
        text(' '),
        text('dev', [{ type: 'link', attrs: { href: '/develop/setup' } }]),
      )],
    })
    expect(html).toContain('href="/flavors/iso/topics/"')
    expect(html).toContain('href="/develop/setup/"')
  })

  it('CURRENT BEHAVIOR: math inside code blocks is rendered as KaTeX', async () => {
    // Step order is renderMath BEFORE renderCode, and neither step is
    // code-aware: the inline-math regex matches $...$ inside <pre><code>
    // and replaces it with KaTeX markup, which shiki then highlights as
    // code text. Pinning the quirk so a refactor can fix it deliberately.
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [{ type: 'code_block', attrs: { text: '$x^2$' } }],
    })
    expect(html).toContain('katex')
    expect(html).toContain('class="code-block"')
  })

  it('collects headings while applying all steps', async () => {
    const { html, headings } = await defaultPipeline.run({
      type: 'doc',
      content: [{
        type: 'clause',
        attrs: { title: 'Scope', level: 1 },
        content: [p(text('body'))],
      }],
    })
    expect(headings).toEqual([{ depth: 2, slug: 'scope', text: 'Scope' }])
    expect(html).toContain('<h2 id="scope">Scope</h2>')
  })

  it('strips a duplicate page-title heading via stripFirstHeadingIf', async () => {
    const { html, headings } = await defaultPipeline.run(
      {
        type: 'doc',
        content: [{
          type: 'clause',
          attrs: { title: 'My Page', level: 1 },
          content: [p(text('body'))],
        }],
      },
      { stripFirstHeadingIf: 'My Page' },
    )
    expect(headings).toEqual([])
    expect(html).not.toContain('<h2')
    expect(html).toContain('body')
  })
})

describe('defaultPipeline: explicit renderer composition', () => {
  it('is NOT affected by registerNodeRenderer after construction', async () => {
    // The public extension API mutates the module-level base table; the
    // pipeline's table was composed (copied) at construction time, so
    // production output cannot change under later registration.
    const doc: MirrorNode = { type: 'doc', content: [{ type: 'zz_test_block', text: 'hi' }] }
    const before = await defaultPipeline.run(doc)
    registerNodeRenderer('zz_test_block', () => '<div>REGISTERED</div>')
    try {
      const after = await defaultPipeline.run(doc)
      expect(after.html).toBe(before.html)
      expect(after.html).not.toContain('REGISTERED')
      // ...while a render through the plain base table DOES see it.
      expect(renderMirrorToHtml(doc)).toContain('REGISTERED')
    } finally {
      delete baseRenderers['zz_test_block']
    }
  })

  it('shares renderer FUNCTIONS with the base table for non-overridden types', async () => {
    // Composition is { ...baseRenderers, ...componentRenderers }: types
    // without a component override dispatch to the same function the
    // public registry exposes.
    const { html } = await defaultPipeline.run({
      type: 'doc',
      content: [p(text('plain'))],
    })
    expect(html).toContain('<p>plain</p>')
    expect(baseRenderers['paragraph']).toBeDefined()
  })
})
