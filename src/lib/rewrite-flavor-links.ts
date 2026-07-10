import { flavors } from '../data/flavors'

const flavorIdPattern = flavors
  .map(f => f.id.replace(/_/g, '-'))
  .join('|')

const re = new RegExp(`(href=")/author/(${flavorIdPattern})(/[^"]*)?"`, 'g')

export function rewriteFlavorLinks(html: string): string {
  return html.replace(re, '$1/flavors/$2$3"')
}
