// Ordered pipeline of HTML transforms applied to mirror-json at build time.
//
// Each step is a pure string-in → string-out (or Promise<string-out>) function.
// The pipeline owns the ordering. Adding a new transform (e.g., image
// lazy-loading) = adding one entry to the array, not editing the loader.
//
// The node-renderer table is composed EXPLICITLY at construction time
// ({ ...baseRenderers, ...componentRenderers } for the production
// pipeline) — no import-time registry mutation, so production output
// does not depend on module import order and tests can exercise the
// exact table production uses.

import {
  renderMirrorWithHeadings,
  baseRenderers,
  type MirrorNode,
  type HeadingRef,
  type NodeRenderer,
} from './mirror-renderer'
import { componentRenderers } from './component-renderers'
import { renderMath } from './render-math'
import { renderCode } from './render-code'
import { rewriteFlavorLinks } from './rewrite-flavor-links'
import { normalizeLinks } from './normalize-links'
import { chipifyVersionMentions } from './version-chips'

export type RenderStep = (input: string) => string | Promise<string>

export interface RenderResult {
  html: string
  headings: HeadingRef[]
}

export interface RenderRunOptions {
  // When set (and non-empty), the first recorded heading whose text
  // matches this title (trimmed) is stripped from both the HTML and
  // the headings array. Renderer-level replacement for the loader's
  // old indexOf/substring HTML surgery.
  stripFirstHeadingIf?: string
}

export class RenderPipeline {
  constructor(
    private readonly renderers: Record<string, NodeRenderer>,
    private readonly steps: RenderStep[],
  ) {}

  async run(mirrorJson: string | MirrorNode, options: RenderRunOptions = {}): Promise<RenderResult> {
    const { html: rawHtml, headings } = renderMirrorWithHeadings(mirrorJson, {
      renderers: this.renderers,
      stripFirstHeadingIf: options.stripFirstHeadingIf,
    })
    let html = rawHtml
    for (const step of this.steps) {
      html = await step(html)
    }
    return { html, headings }
  }
}

// The production pipeline: base renderers + component overrides,
// then renderMath → renderCode → chipifyVersionMentions →
// rewriteFlavorLinks → normalizeLinks.
export const defaultPipeline = new RenderPipeline(
  { ...baseRenderers, ...componentRenderers },
  [
    renderMath,
    renderCode,
    chipifyVersionMentions,
    rewriteFlavorLinks,
    normalizeLinks,
  ],
)
