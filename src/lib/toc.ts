// The ONE table-of-contents predicate, shared by TOC.astro and the
// pages that lay out around it. Pages decide grid columns / TOC
// placement from hasToc(headings); TOC.astro renders from
// computeTocItems(headings) — if the two disagreed, pages would reserve
// a TOC column for a TOC that never renders (or vice versa).
//
// The rule: headings at depth 2–4, and at least 2 of them (a lone TOC
// entry is noise).

export interface TocHeading {
  depth: number
  slug: string
  text: string
}

// Headings eligible for the TOC (depth 2–4), in document order.
export function computeTocItems<T extends TocHeading>(headings: readonly T[]): T[] {
  return headings.filter(h => h.depth >= 2 && h.depth <= 4)
}

// Whether a page with these headings gets a TOC at all.
export function hasToc(headings: readonly TocHeading[]): boolean {
  return computeTocItems(headings).length >= 2
}
