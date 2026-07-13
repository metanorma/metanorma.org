import { describe, expect, it } from 'vitest'
import { SidebarRegistry } from '../registry'
import type { SidebarItem } from '../site'

const sampleItems = (texts: string[]): SidebarItem[] =>
  texts.map(text => ({ text, link: `/${text.toLowerCase()}/` }))

describe('SidebarRegistry', () => {
  it('empty registry resolves null for any path', () => {
    const reg = new SidebarRegistry()
    expect(reg.resolve('/any/path/')).toBeNull()
    expect(reg.resolve('/')).toBeNull()
  })

  it('resolves items by exact prefix match', () => {
    const reg = new SidebarRegistry({
      handAuthored: { '/author/': sampleItems(['Basics', 'Topics']) },
    })
    expect(reg.resolve('/author/')).toEqual(sampleItems(['Basics', 'Topics']))
  })

  it('resolves items for any path under a registered prefix', () => {
    const reg = new SidebarRegistry({
      handAuthored: { '/install/': sampleItems(['macOS', 'Linux']) },
    })
    expect(reg.resolve('/install/macos/')).toEqual(sampleItems(['macOS', 'Linux']))
    expect(reg.resolve('/install/usage/')).toEqual(sampleItems(['macOS', 'Linux']))
  })

  it('longest-prefix wins when multiple prefixes match', () => {
    const top = sampleItems(['Author'])
    const sub = sampleItems(['Approach', 'Workflow'])
    const reg = new SidebarRegistry({
      handAuthored: {
        '/author/': top,
        '/author/basics/': sub,
      },
    })
    expect(reg.resolve('/author/')).toEqual(top)
    expect(reg.resolve('/author/basics/')).toEqual(sub)
    expect(reg.resolve('/author/basics/workflow/')).toEqual(sub)
  })

  it('hand-authored overrides generated for the same prefix', () => {
    const generated = sampleItems(['Gen-A', 'Gen-B'])
    const handAuthored = sampleItems(['Hand-X'])
    const reg = new SidebarRegistry({
      generated: { '/author/': generated },
      handAuthored: { '/author/': handAuthored },
    })
    expect(reg.resolve('/author/')).toEqual(handAuthored)
  })

  it('generated sub-paths of hand-authored prefixes are NOT suppressed — longest-prefix wins', () => {
    const handAuthored = sampleItems(['Getting Started', 'Basics'])
    const generatedSub = sampleItems(['Approach', 'Workflow'])
    const reg = new SidebarRegistry({
      generated: { '/author/basics/': generatedSub },
      handAuthored: { '/author/': handAuthored },
    })
    // /author/basics/ resolves to the generated sidebar (longest prefix),
    // NOT the hand-authored /author/ sidebar.
    expect(reg.resolve('/author/basics/')).toEqual(generatedSub)
    expect(reg.resolve('/author/basics/approach/')).toEqual(generatedSub)
    // /author/ itself still uses the hand-authored sidebar.
    expect(reg.resolve('/author/')).toEqual(handAuthored)
  })

  it('generated entries NOT covered by hand-authored are preserved', () => {
    const reg = new SidebarRegistry({
      generated: { '/author/iec/': sampleItems(['Ref', 'Sample']) },
      handAuthored: { '/install/': sampleItems(['macOS']) },
    })
    // /author/iec/ is not sub-path of /install/, so it survives.
    expect(reg.resolve('/author/iec/')).toEqual(sampleItems(['Ref', 'Sample']))
  })

  it('trailing slash on pathname is normalized', () => {
    const reg = new SidebarRegistry({
      handAuthored: { '/learn/': sampleItems(['Lessons']) },
    })
    expect(reg.resolve('/learn')).toEqual(sampleItems(['Lessons']))
    expect(reg.resolve('/learn/')).toEqual(sampleItems(['Lessons']))
  })

  it('prefixes() lists all registered prefixes sorted', () => {
    const reg = new SidebarRegistry({
      handAuthored: {
        '/zeta/': [],
        '/alpha/': [],
        '/mid/': [],
      },
    })
    expect(reg.prefixes()).toEqual(['/alpha/', '/mid/', '/zeta/'])
  })
})
