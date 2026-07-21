// Merge/domain logic for the model-driven attribute reference pages.
//
// A flavor's reference page shows THREE kinds of entries, distinguished
// by per-entry provenance (`origin`, rendered as applicability chips):
//
//   own       — attributes from the flavor's own manifest
//               (origin === flavorId). Same-name entries from inherited
//               manifests are REPLACED entirely (flavor wins; no
//               field-level merge).
//   inherited — attributes from the manifest named by the flavor's
//               `inherits_from` (standoc), included when they have no
//               `applies_to` (apply to all flavors) or their
//               `applies_to` contains this flavor.
//   cross     — attributes from ANY OTHER manifest whose `applies_to`
//               contains this flavor (origin === that manifest's id).
//
// Category order: the flavor's own categories first (manifest order),
// then inherited-only categories (parent manifest order, then other
// manifests in registry order). Within a category, own entries first
// (manifest order), then inherited (parent order, then cross-manifest).
//
// The standoc page itself is just the standoc manifest — everything is
// `own`, nothing is inherited.
//
// Pure functions over plain manifest data — no Astro imports — so specs
// run under plain vitest and the routes stay thin.

import type { AttrManifest, Attribute, AttrSectionProse } from './attr-schema'

// One attribute entry on a merged page, with its provenance.
export interface MergedAttribute {
  name: string
  data: Attribute
  // Manifest id this entry came from: 'standoc', the page's flavor id,
  // or another manifest's id (cross-manifest applies_to).
  origin: string
}

// Attributes of one category, grouped by subsection in first-appearance
// order (subsection-less entries first when they appear first).
export interface SubsectionGroup {
  subsection?: string
  attrs: MergedAttribute[]
}

export interface MergedCategory {
  name: string
  // origin === page flavor, grouped by subsection (manifest order).
  own: SubsectionGroup[]
  // origin !== page flavor, grouped by subsection. Empty on the
  // standoc page and for flavors without a parent manifest.
  inherited: SubsectionGroup[]
  // The manifest's `sections:` prose blocks for this category.
  prose: AttrSectionProse[]
}

export interface MergedPage {
  flavorId: string
  // Own manifest's display label (e.g. 'IETF (RFC XML v3)').
  label: string
  manifest: AttrManifest
  // Label of the manifest entries were inherited from (null on the
  // standoc page) — used for the "Inherited from …" details summary.
  parentLabel: string | null
  categories: MergedCategory[]
}

// Whether an attribute from another manifest applies to a flavor page:
// no `applies_to` means all flavors; otherwise subset membership.
export function appliesTo(data: Attribute, flavorId: string): boolean {
  return !data.applies_to || data.applies_to.includes(flavorId)
}

// Group entries by subsection, preserving first-appearance order of the
// subsections and manifest order within each group.
export function groupBySubsection(attrs: MergedAttribute[]): SubsectionGroup[] {
  const groups: SubsectionGroup[] = []
  const byKey = new Map<string, SubsectionGroup>()
  for (const attr of attrs) {
    const key = attr.data.subsection ?? ''
    let group = byKey.get(key)
    if (!group) {
      group = { subsection: attr.data.subsection, attrs: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.attrs.push(attr)
  }
  return groups
}

function flat(attrs: MergedAttribute[]): SubsectionGroup[] {
  return groupBySubsection(attrs)
}

// Merge the manifests into the attribute set for one flavor page.
// `manifests` maps manifest id → parsed manifest (the `attributes`
// collection entries' data).
export function mergeForFlavor(
  flavorId: string,
  manifests: Record<string, AttrManifest>,
): MergedPage {
  const manifest = manifests[flavorId]
  if (!manifest) {
    throw new Error(`mergeForFlavor: no manifest for "${flavorId}"`)
  }

  // The standoc page is just the standoc manifest.
  if (!manifest.inherits_from) {
    const own: MergedAttribute[] = Object.entries(manifest.attributes)
      .map(([name, data]) => ({ name, data, origin: flavorId }))
    return {
      flavorId,
      label: manifest.label,
      manifest,
      parentLabel: null,
      categories: buildCategories(manifest, own, []),
    }
  }

  const parentId = manifest.inherits_from
  const parent = manifests[parentId]

  const own: MergedAttribute[] = Object.entries(manifest.attributes)
    .map(([name, data]) => ({ name, data, origin: flavorId }))
  const ownNames = new Set(own.map(a => a.name))

  const inherited: MergedAttribute[] = []
  if (parent) {
    for (const [name, data] of Object.entries(parent.attributes)) {
      if (ownNames.has(name)) continue // flavor wins
      if (!appliesTo(data, flavorId)) continue
      inherited.push({ name, data, origin: parentId })
    }
  }
  // Cross-manifest: attributes anywhere else whose applies_to names
  // this flavor. Registry order (the manifests record's key order) is
  // deterministic.
  for (const [id, other] of Object.entries(manifests)) {
    if (id === flavorId || id === parentId) continue
    for (const [name, data] of Object.entries(other.attributes)) {
      if (ownNames.has(name)) continue
      if (!data.applies_to || !data.applies_to.includes(flavorId)) continue
      inherited.push({ name, data, origin: id })
    }
  }

  return {
    flavorId,
    label: manifest.label,
    manifest,
    parentLabel: parent ? parent.label : null,
    categories: buildCategories(manifest, own, inherited),
  }
}

// Category union: own categories first (first-appearance order), then
// inherited-only categories (first-appearance order within inherited).
function buildCategories(
  manifest: AttrManifest,
  own: MergedAttribute[],
  inherited: MergedAttribute[],
): MergedCategory[] {
  const order: string[] = []
  const seen = new Set<string>()
  const note = (cat: string) => {
    if (!seen.has(cat)) {
      seen.add(cat)
      order.push(cat)
    }
  }
  for (const attr of own) note(attr.data.category)
  for (const attr of inherited) note(attr.data.category)

  const proseByCategory = new Map<string, AttrSectionProse[]>()
  for (const block of manifest.sections ?? []) {
    const list = proseByCategory.get(block.name) ?? []
    list.push(block)
    proseByCategory.set(block.name, list)
  }
  // A prose block can name a category with no attributes at all.
  for (const name of proseByCategory.keys()) note(name)

  return order.map(name => ({
    name,
    own: flat(own.filter(a => a.data.category === name)),
    inherited: flat(inherited.filter(a => a.data.category === name)),
    prose: proseByCategory.get(name) ?? [],
  }))
}

// Heading-id slugger for categories/subsections: lowercase, backticks
// stripped, non-alphanumeric runs collapse to '-'. Matches the explicit
// [[anchor]] ids of the superseded pages for the headings that had them
// ('Document relations' → document-relations, 'Drafting group' →
// drafting-group, 'Smart quotes' → smart-quotes, 'Timestamps' →
// timestamps).
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// The anchor id for an attribute entry: the explicit `anchor:` when the
// manifest gives one, else the attribute name itself (whitespace is not
// legal in HTML ids, so space runs become '-'; `{_i}`-style braces are
// legal and stay).
export function anchorIdFor(name: string, data: Attribute): string {
  return data.anchor ?? name.replace(/\s+/g, '-')
}

// Display label for a manifest id, for applicability chips
// ('Metanorma (all flavors)', 'ISO', …). Falls back to the id.
export function labelFor(manifests: Record<string, AttrManifest>, id: string): string {
  return manifests[id]?.label ?? id
}

// TOC headings for a merged page: categories at depth 2, subsections at
// depth 3 — the SAME ids AttributeRef.astro emits (both use slugify), so
// TOC links and scroll-spy targets can never drift apart. Attribute
// entries themselves are deliberately NOT in the TOC (a standoc page
// would drown it in 200+ entries).
export interface AttrTocHeading { depth: number; slug: string; text: string }

export function tocHeadings(page: MergedPage): AttrTocHeading[] {
  const out: AttrTocHeading[] = []
  const seen = new Set<string>()
  for (const cat of page.categories) {
    const catSlug = slugify(cat.name)
    if (seen.has(catSlug)) continue
    seen.add(catSlug)
    out.push({ depth: 2, slug: catSlug, text: cat.name })
    const subs: string[] = []
    const subSeen = new Set<string>()
    const note = (sub?: string) => {
      if (sub && !subSeen.has(sub)) {
        subSeen.add(sub)
        subs.push(sub)
      }
    }
    for (const g of [...cat.own, ...cat.inherited]) note(g.subsection)
    for (const p of cat.prose) note(p.subsection)
    for (const sub of subs) {
      const slug = slugify(sub)
      if (seen.has(slug)) continue
      seen.add(slug)
      out.push({ depth: 3, slug, text: sub })
    }
  }
  return out
}
