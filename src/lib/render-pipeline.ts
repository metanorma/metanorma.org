// Ordered pipeline of HTML transforms applied to mirror-json at build time.
//
// Each step is a pure string-in → string-out (or Promise<string-out>) function.
// The pipeline owns the ordering. Adding a new transform (e.g., image
// lazy-loading) = adding one entry to the array, not editing the loader.

import { renderMirrorToHtml, type MirrorNode } from './mirror-renderer'
import { renderMath } from './render-math'
import { renderCode } from './render-code'

export type RenderStep = (input: string) => string | Promise<string>

export class RenderPipeline {
  constructor(private readonly steps: RenderStep[]) {}

  async run(mirrorJson: string | MirrorNode): Promise<string> {
    let html = typeof mirrorJson === 'string'
      ? renderMirrorToHtml(mirrorJson)
      : renderMirrorToHtml(mirrorJson)
    for (const step of this.steps) {
      html = await step(html)
    }
    return html
  }
}

export const defaultPipeline = new RenderPipeline([
  renderMath,
  renderCode,
])
