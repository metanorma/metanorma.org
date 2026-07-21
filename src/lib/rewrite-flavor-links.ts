import { flavors } from '../data/flavors'
import { kebabSegment } from './kebab'

const flavorIdPattern = flavors
  .map(f => kebabSegment(f.id))
  .join('|')

const re = new RegExp(`(href=")/author/(${flavorIdPattern})(/[^"]*)?"`, 'g')

export function rewriteFlavorLinks(html: string): string {
  return html.replace(re, '$1/flavors/$2$3"')
}
