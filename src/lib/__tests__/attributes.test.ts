import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'
import {
  mergeForFlavor,
  appliesTo,
  groupBySubsection,
  slugify,
  anchorIdFor,
  labelFor,
  tocHeadings,
  type MergedAttribute,
} from '../attributes'
import type { AttrManifest } from '../attr-schema'
import { collections } from '../../content.config'

// ── Real manifests: load + validate against the collection schema ────

const schema = collections.attributes.schema
if (!schema || typeof schema === 'function') {
  throw new Error('content.config.ts attributes collection must use a static zod schema')
}

const MANIFEST_IDS = ['standoc', 'iso', 'ietf', 'ietf-v2']

function loadRealManifests(): Record<string, AttrManifest> {
  const out: Record<string, AttrManifest> = {}
  for (const id of MANIFEST_IDS) {
    out[id] = load(readFileSync(join(process.cwd(), 'attributes', `${id}.yaml`), 'utf-8')) as AttrManifest
  }
  return out
}

describe('attributes collection schema vs real manifests', () => {
  it('validates all four shipped manifests', () => {
    for (const id of MANIFEST_IDS) {
      const raw = load(readFileSync(join(process.cwd(), 'attributes', `${id}.yaml`), 'utf-8'))
      const parsed = schema.safeParse(raw)
      expect(parsed.success, `attributes/${id}.yaml conforms to content.config.ts schema`).toBe(true)
    }
  })

  it('gives every attribute a category', () => {
    for (const [id, manifest] of Object.entries(loadRealManifests())) {
      for (const [name, data] of Object.entries(manifest.attributes)) {
        expect(data.category, `${id}:${name} has a category`).toBeTruthy()
      }
    }
  })
})

// ── Synthetic manifests for merge-rule specs ─────────────────────────

function attr(category: string, extra: Record<string, unknown> = {}) {
  return { category, ...extra }
}

const synthetic: Record<string, AttrManifest> = {
  standoc: {
    flavor: 'standoc',
    label: 'Metanorma (all flavors)',
    inherits_from: null,
    attributes: {
      // applies to all flavors (no applies_to)
      publisher: attr('Document information', { type: 'string' }),
      // standoc attribute restricted to iso+nist
      'iso-only-thing': attr('Document information', { applies_to: ['iso', 'nist'] }),
      // standoc attribute restricted to nist only
      'nist-only-thing': attr('Bibliography', { applies_to: ['nist'] }),
      // overridden by the iso manifest
      doctype: attr('Document information', { type: 'string', description: 'standoc version' }),
      // a category that only exists in standoc
      'flush-caches': attr('Bibliography', { type: 'boolean' }),
    },
  },
  iso: {
    flavor: 'iso',
    label: 'ISO',
    inherits_from: 'standoc',
    attributes: {
      doctype: attr('Document information', { type: 'enum', description: 'iso version' }),
      docnumber: attr('Document information', { type: 'string' }),
      'technical-committee': attr('Authorship', { required: true }),
    },
  },
  nist: {
    flavor: 'nist',
    label: 'NIST',
    inherits_from: 'standoc',
    attributes: {
      'nist-thing': attr('Document information'),
    },
  },
  // cross-manifest: an ogc attribute that also applies to iso
  ogc: {
    flavor: 'ogc',
    label: 'OGC',
    inherits_from: 'standoc',
    attributes: {
      'shared-with-iso': attr('Document relations', { applies_to: ['ogc', 'iso'] }),
      'not-shared': attr('Document relations'),
    },
  },
}

describe('appliesTo', () => {
  it('treats a missing applies_to as all flavors', () => {
    expect(appliesTo({ category: 'C' }, 'iso')).toBe(true)
  })

  it('checks subset membership otherwise', () => {
    const data = { category: 'C', applies_to: ['iso', 'nist'] }
    expect(appliesTo(data, 'iso')).toBe(true)
    expect(appliesTo(data, 'ietf')).toBe(false)
  })
})

describe('mergeForFlavor — standoc page', () => {
  it('is just the standoc manifest: all own, nothing inherited', () => {
    const page = mergeForFlavor('standoc', synthetic)
    expect(page.flavorId).toBe('standoc')
    expect(page.parentLabel).toBeNull()
    const all = page.categories.flatMap(c => c.own.flatMap(g => g.attrs))
    // Category grouping reorders interleaved manifest entries; the SET
    // of attributes is exactly the manifest's.
    expect(all.map(a => a.name).sort()).toEqual(Object.keys(synthetic.standoc.attributes).sort())
    expect(all.every(a => a.origin === 'standoc')).toBe(true)
    expect(page.categories.every(c => c.inherited.length === 0)).toBe(true)
    // Category order follows first appearance in the manifest.
    expect(page.categories.map(c => c.name)).toEqual(['Document information', 'Bibliography'])
  })

  it('keeps standoc category order and attaches sections prose', () => {
    const withProse: Record<string, AttrManifest> = {
      standoc: {
        ...synthetic.standoc,
        sections: [
          { name: 'Bibliography', subsection: 'Caching', prose: 'Cache prose.' },
          { name: 'Document information', prose: 'Docinfo prose.' },
          { name: 'Prose-only category', prose: 'Orphan prose.' },
        ],
      },
    }
    const page = mergeForFlavor('standoc', withProse)
    expect(page.categories.map(c => c.name)).toEqual([
      'Document information', 'Bibliography', 'Prose-only category',
    ])
    const biblio = page.categories.find(c => c.name === 'Bibliography')!
    expect(biblio.prose).toHaveLength(1)
    expect(biblio.prose[0].subsection).toBe('Caching')
    const orphan = page.categories.find(c => c.name === 'Prose-only category')!
    expect(orphan.own.flatMap(g => g.attrs)).toHaveLength(0)
    expect(orphan.prose).toHaveLength(1)
  })
})

describe('mergeForFlavor — flavor page', () => {
  it('is the union of own and applicable inherited attributes', () => {
    const page = mergeForFlavor('iso', synthetic)
    const names = page.categories
      .flatMap(c => [...c.own, ...c.inherited])
      .flatMap(g => g.attrs.map(a => a.name))
    expect(names).toContain('docnumber')            // own
    expect(names).toContain('publisher')            // inherited, no applies_to
    expect(names).toContain('iso-only-thing')       // inherited, applies_to includes iso
    expect(names).not.toContain('nist-only-thing')  // applies_to excludes iso
    expect(names).toContain('flush-caches')         // inherited-only category member
  })

  it('flavor wins on same-name attributes (full replacement, provenance flips)', () => {
    const page = mergeForFlavor('iso', synthetic)
    const docinfo = page.categories.find(c => c.name === 'Document information')!
    const ownDoctype = docinfo.own.flatMap(g => g.attrs).find(a => a.name === 'doctype')
    const inheritedDoctype = docinfo.inherited.flatMap(g => g.attrs).find(a => a.name === 'doctype')
    expect(ownDoctype?.data.description).toBe('iso version')
    expect(ownDoctype?.origin).toBe('iso')
    expect(inheritedDoctype).toBeUndefined()
  })

  it('records provenance: own, standoc-inherited, and cross-manifest', () => {
    const page = mergeForFlavor('iso', synthetic)
    const all = page.categories
      .flatMap(c => [...c.own, ...c.inherited])
      .flatMap(g => g.attrs)
    const byName = new Map(all.map(a => [a.name, a.origin]))
    expect(byName.get('docnumber')).toBe('iso')
    expect(byName.get('publisher')).toBe('standoc')
    // cross-manifest: ogc attribute whose applies_to names iso
    expect(byName.get('shared-with-iso')).toBe('ogc')
    // cross-manifest attributes WITHOUT applies_to never leak in
    expect(byName.has('not-shared')).toBe(false)
    expect(byName.has('nist-thing')).toBe(false)
  })

  it('orders categories: flavor categories first, then inherited-only ones', () => {
    const page = mergeForFlavor('iso', synthetic)
    // iso manifest order: Document information, Authorship; standoc-only
    // Bibliography follows; cross-manifest Document relations last.
    expect(page.categories.map(c => c.name)).toEqual([
      'Document information', 'Authorship', 'Bibliography', 'Document relations',
    ])
    expect(page.parentLabel).toBe('Metanorma (all flavors)')
  })

  it('keeps manifest order within own and inherited groups', () => {
    const page = mergeForFlavor('iso', synthetic)
    const docinfo = page.categories.find(c => c.name === 'Document information')!
    expect(docinfo.own.flatMap(g => g.attrs).map(a => a.name)).toEqual(['doctype', 'docnumber'])
    const inheritedNames = docinfo.inherited.flatMap(g => g.attrs).map(a => a.name)
    expect(inheritedNames).toEqual(['publisher', 'iso-only-thing'])
  })

  it('throws for an unknown flavor', () => {
    expect(() => mergeForFlavor('bogus', synthetic)).toThrow(/bogus/)
  })
})

describe('groupBySubsection', () => {
  it('groups in first-appearance order, preserving manifest order within', () => {
    const attrs: MergedAttribute[] = [
      { name: 'a', data: attr('C', { subsection: 'One' }), origin: 'standoc' },
      { name: 'b', data: attr('C'), origin: 'standoc' },
      { name: 'c', data: attr('C', { subsection: 'Two' }), origin: 'standoc' },
      { name: 'd', data: attr('C', { subsection: 'One' }), origin: 'standoc' },
      { name: 'e', data: attr('C'), origin: 'standoc' },
    ]
    const groups = groupBySubsection(attrs)
    expect(groups.map(g => g.subsection)).toEqual(['One', undefined, 'Two'])
    expect(groups[0].attrs.map(a => a.name)).toEqual(['a', 'd'])
    expect(groups[1].attrs.map(a => a.name)).toEqual(['b', 'e'])
    expect(groups[2].attrs.map(a => a.name)).toEqual(['c'])
  })
})

describe('slugify', () => {
  it('matches the explicit [[anchor]] ids of the superseded pages', () => {
    expect(slugify('Document relations')).toBe('document-relations')
    expect(slugify('Smart quotes')).toBe('smart-quotes')
    expect(slugify('Timestamps')).toBe('timestamps')
    expect(slugify('Drafting group')).toBe('drafting-group')
    expect(slugify('Distribution group')).toBe('distribution-group')
  })

  it('strips backticks and collapses punctuation', () => {
    expect(slugify('Processing instructions for `xml2rfc`')).toBe('processing-instructions-for-xml2rfc')
    expect(slugify('Document identifier / Publisher')).toBe('document-identifier-publisher')
  })
})

describe('anchorIdFor', () => {
  it('prefers the explicit anchor field', () => {
    expect(anchorIdFor('fullname{_i}', attr('C', { anchor: 'fullname' }))).toBe('fullname')
  })

  it('falls back to the attribute name, with whitespace dasherized', () => {
    expect(anchorIdFor('docnumber', attr('C'))).toBe('docnumber')
    expect(anchorIdFor('relaton-data-source-{id}', attr('C'))).toBe('relaton-data-source-{id}')
    expect(anchorIdFor('= Document Title', attr('C'))).toBe('=-Document-Title')
  })
})

describe('tocHeadings', () => {
  it('emits categories at depth 2 and deduped subsections at depth 3', () => {
    const manifests: Record<string, AttrManifest> = {
      standoc: {
        flavor: 'standoc',
        label: 'Metanorma (all flavors)',
        inherits_from: null,
        sections: [
          { name: 'Document relations', subsection: 'General', prose: 'Prose.' },
        ],
        attributes: {
          obsoletes: { category: 'Document relations', subsection: 'Part of' },
          updates: { category: 'Document relations', subsection: 'Part of' },
          'translated-from': { category: 'Document relations', subsection: 'Translated from' },
          publisher: { category: 'Document information' },
        },
      },
    }
    const page = mergeForFlavor('standoc', manifests)
    expect(tocHeadings(page)).toEqual([
      { depth: 2, slug: 'document-relations', text: 'Document relations' },
      { depth: 3, slug: 'part-of', text: 'Part of' },
      { depth: 3, slug: 'translated-from', text: 'Translated from' },
      { depth: 3, slug: 'general', text: 'General' },
      { depth: 2, slug: 'document-information', text: 'Document information' },
    ])
  })
})

describe('labelFor', () => {
  it('resolves manifest labels, falling back to the id', () => {
    expect(labelFor(synthetic, 'iso')).toBe('ISO')
    expect(labelFor(synthetic, 'bogus')).toBe('bogus')
  })
})

describe('mergeForFlavor — real manifests', () => {
  it('merges every flavor page without losing own attributes', () => {
    const manifests = loadRealManifests()
    for (const id of ['iso', 'ietf', 'ietf-v2']) {
      const page = mergeForFlavor(id, manifests)
      const ownCount = page.categories
        .flatMap(c => c.own).flatMap(g => g.attrs).length
      expect(ownCount, `${id}: all own attributes present`)
        .toBe(Object.keys(manifests[id].attributes).length)
      // standoc inheritance actually contributes
      const inheritedCount = page.categories
        .flatMap(c => c.inherited).flatMap(g => g.attrs).length
      expect(inheritedCount, `${id}: inherits standoc attributes`).toBeGreaterThan(100)
    }
  })
})
