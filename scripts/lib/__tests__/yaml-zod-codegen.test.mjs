import { describe, it, expect } from 'vitest'
import { toZod, generateZodModule } from '../yaml-zod-codegen.mjs'

describe('toZod', () => {
  it('emits enums', () => {
    expect(toZod({ enum: ['a', 'b'] })).toBe('z.enum(["a", "b"])')
  })

  it('emits const as literal', () => {
    expect(toZod({ const: 'fixed' })).toBe('z.literal("fixed")')
    expect(toZod({ const: 42 })).toBe('z.literal(42)')
  })

  it('emits strings with constraints', () => {
    expect(toZod({ type: 'string', pattern: '^[a-z]+$', minLength: 1 }))
      .toBe('z.string().regex(/^[a-z]+$/).min(1)')
  })

  it('emits scalars', () => {
    expect(toZod({ type: 'integer' })).toBe('z.number().int()')
    expect(toZod({ type: 'number' })).toBe('z.number()')
    expect(toZod({ type: 'boolean' })).toBe('z.boolean()')
    expect(toZod({ type: 'null' })).toBe('z.null()')
  })

  it('emits arrays', () => {
    expect(toZod({ type: 'array', items: { type: 'string' } }))
      .toBe('z.array(z.string())')
  })

  it('emits unions from anyOf', () => {
    expect(toZod({ anyOf: [{ type: 'string' }, { type: 'null' }] }))
      .toBe('z.union([z.string(), z.null()])')
  })

  it('resolves local $defs refs to identifiers', () => {
    expect(toZod({ $ref: '#/$defs/versionRefSchema' })).toBe('versionRefSchema')
  })

  it('emits records from additionalProperties schemas', () => {
    expect(toZod({
      type: 'object',
      additionalProperties: { type: 'string' },
    })).toBe('z.record(z.string(), z.string())')
  })

  it('emits records with patterned keys', () => {
    expect(toZod({
      type: 'object',
      propertyNames: { pattern: '^[a-z]+$' },
      additionalProperties: { type: 'string' },
    })).toBe('z.record(z.string().regex(/^[a-z]+$/), z.string())')
  })

  it('marks optional properties', () => {
    const out = toZod({
      type: 'object',
      required: ['a'],
      properties: { a: { type: 'string' }, b: { type: 'string' } },
    })
    expect(out).toContain('"a": z.string(),')
    expect(out).toContain('"b": z.string().optional(),')
  })

  it('maps additionalProperties to strictness', () => {
    const base = { type: 'object', properties: { a: { type: 'string' } } }
    expect(toZod({ ...base, additionalProperties: false })).toMatch(/^z\.strictObject\(/)
    expect(toZod({ ...base, additionalProperties: true })).toMatch(/\.passthrough\(\)$/)
    expect(toZod(base)).toMatch(/^z\.object\(/)
  })

  it('throws loudly on unsupported constructs', () => {
    expect(() => toZod({ type: 'frob' })).toThrow(/unsupported type/)
    expect(() => toZod({ allOf: [] })).toThrow(/unsupported JSON Schema construct/)
    expect(() => toZod({ $ref: 'other.yaml#/x' })).toThrow(/unsupported \$ref/)
  })
})

describe('generateZodModule', () => {
  const schema = {
    title: 'Test',
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string', description: 'The name.' } },
    $defs: {
      childSchema: {
        description: 'A child.',
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
    },
  }

  it('emits a deterministic module with exports for defs and root', () => {
    const a = generateZodModule({ schema, rootName: 'rootSchema', sourcePath: 'schemas/test.schema.yaml' })
    const b = generateZodModule({ schema, rootName: 'rootSchema', sourcePath: 'schemas/test.schema.yaml' })
    expect(a).toBe(b)
    expect(a).toContain('// GENERATED from schemas/test.schema.yaml')
    expect(a).toContain("import { z } from 'zod'")
    expect(a).toContain('// A child.\nexport const childSchema =')
    expect(a).toContain('export const rootSchema = z.object({')
    expect(a).toContain('// The name.\n  "name": z.string(),')
  })
})
