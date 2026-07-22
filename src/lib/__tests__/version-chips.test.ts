import { describe, it, expect } from 'vitest'
import { versionChip, chipifyVersionMentions } from '../version-chips'

const URL = 'https://github.com/metanorma/metanorma-jis/releases/tag/v0.3.7'

describe('versionChip', () => {
  it('renders an added chip from a release URL', () => {
    expect(versionChip(URL, 'added')).toBe(
      `<a class="attr-chip attr-chip-version" href="${URL}" target="_blank" rel="noopener" title="Added in metanorma-jis v0.3.7">metanorma-jis ≥ v0.3.7</a>`,
    )
  })

  it('renders a deprecated chip', () => {
    expect(versionChip(URL, 'deprecated')).toBe(
      `<a class="attr-chip attr-chip-warn" href="${URL}" target="_blank" rel="noopener" title="Deprecated in metanorma-jis v0.3.7">deprecated in metanorma-jis ≥ v0.3.7</a>`,
    )
  })

  it('returns null for non-release URLs', () => {
    expect(versionChip('https://example.com/rel/v9', 'added')).toBeNull()
    expect(versionChip('https://github.com/metanorma/metanorma-iso/releases', 'added')).toBeNull()
  })
})

describe('chipifyVersionMentions (mirror post-render step)', () => {
  const autolink = `<a href="${URL}" target="_blank" rel="noopener">${URL}</a>`

  it('converts the mirror-autolinked added-in form to a chip', () => {
    const html = `<p>Applies to numbers [added in ${autolink}]. Allowed values are arabic.</p>`
    expect(chipifyVersionMentions(html)).toBe(
      `<p>Applies to numbers <a class="attr-chip attr-chip-version" href="${URL}" target="_blank" rel="noopener" title="Added in metanorma-jis v0.3.7">metanorma-jis ≥ v0.3.7</a>. Allowed values are arabic.</p>`,
    )
  })

  it('converts deprecated-in to a warning chip', () => {
    const html = `<p>Legacy [deprecated in ${autolink}].</p>`
    expect(chipifyVersionMentions(html)).toContain('attr-chip attr-chip-warn')
    expect(chipifyVersionMentions(html)).toContain('deprecated in metanorma-jis ≥ v0.3.7')
  })

  it('falls back to a compact release link for non-release URLs', () => {
    const other = '<a href="https://example.com/rel/v9" target="_blank" rel="noopener">https://example.com/rel/v9</a>'
    const html = `<p>x [added in ${other}].</p>`
    expect(chipifyVersionMentions(html)).toBe(
      '<p>x <a class="added-in" href="https://example.com/rel/v9" target="_blank" rel="noopener">added in v9</a>.</p>',
    )
  })

  it('leaves escaped/code text and other content untouched', () => {
    const html = '<p>[added in plain text without anchor]</p><pre><code>[added in &lt;a href=&quot;x&quot;&gt;]</code></pre>'
    expect(chipifyVersionMentions(html)).toBe(html)
  })
})
