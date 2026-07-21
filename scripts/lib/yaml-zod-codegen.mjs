// YAML (JSON Schema) → zod code emitter.
//
// The schemas in schemas/*.schema.yaml are the single source of truth;
// this turns the subset of JSON Schema draft 2020-12 they use into clean,
// idiomatic zod. Unsupported constructs throw loudly — never silently
// misgenerate. Output is deterministic (YAML key order is preserved).

function quote(value) {
  return JSON.stringify(value)
}

function commentLines(description, indent) {
  if (!description) return []
  const pad = ' '.repeat(indent)
  return description
    .split('\n')
    .map(line => `${pad}// ${line.trim()}`.trimEnd())
}

// Emit a zod expression for a schema node.
export function toZod(node, path = 'root') {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    throw new Error(`${path}: schema node must be an object`)
  }

  if (node.$ref) {
    const m = /^#\/\$defs\/([A-Za-z0-9_]+)$/.exec(node.$ref)
    if (!m) throw new Error(`${path}: unsupported $ref "${node.$ref}" (only local #/$defs/ refs)`)
    return m[1]
  }

  if (node.const !== undefined) return `z.literal(${quote(node.const)})`

  if (node.enum) {
    if (!Array.isArray(node.enum) || node.enum.some(v => typeof v !== 'string')) {
      throw new Error(`${path}: only string enums are supported`)
    }
    return `z.enum([${node.enum.map(quote).join(', ')}])`
  }

  if (node.anyOf) {
    const parts = node.anyOf.map((sub, i) => toZod(sub, `${path}.anyOf[${i}]`))
    if (parts.length === 1) return parts[0]
    return `z.union([${parts.join(', ')}])`
  }

  const unsupported = ['allOf', 'if', 'then', 'oneOf', 'not', '$comment']
    .filter(k => node[k] !== undefined)
  if (unsupported.length) {
    throw new Error(`${path}: unsupported JSON Schema construct(s): ${unsupported.join(', ')}`)
  }

  switch (node.type) {
    case 'string': {
      let out = 'z.string()'
      if (node.pattern) out += `.regex(/${node.pattern}/)`
      if (node.minLength != null) out += `.min(${node.minLength})`
      return out
    }
    case 'integer':
      return 'z.number().int()'
    case 'number':
      return 'z.number()'
    case 'boolean':
      return 'z.boolean()'
    case 'null':
      return 'z.null()'
    case 'array': {
      if (!node.items) throw new Error(`${path}: array without items`)
      let out = `z.array(${toZod(node.items, `${path}.items`)})`
      if (node.minItems != null) out += `.min(${node.minItems})`
      return out
    }
    case 'object':
      return objectToZod(node, path)
    default:
      throw new Error(`${path}: unsupported type ${quote(node.type)}`)
  }
}

function objectToZod(node, path) {
  const { properties, additionalProperties } = node

  // Record form: no declared properties, a schema for values.
  if (!properties && additionalProperties && typeof additionalProperties === 'object') {
    let key = 'z.string()'
    if (node.propertyNames?.pattern) key = `z.string().regex(/${node.propertyNames.pattern}/)`
    return `z.record(${key}, ${toZod(additionalProperties, `${path}.values`)})`
  }

  const required = new Set(node.required || [])
  const entries = Object.entries(properties || {})
  const lines = entries.map(([key, prop]) => {
    const comments = commentLines(prop.description, 2)
    let expr = toZod(prop, `${path}.${key}`)
    if (!required.has(key)) expr += '.optional()'
    return [...comments, `  ${JSON.stringify(key)}: ${expr},`]
  })
  const body = entries.length ? `\n${lines.flat().join('\n')}\n` : ''

  if (additionalProperties === false) return `z.strictObject({${body}})`
  if (additionalProperties === true) return `z.object({${body}}).passthrough()`
  if (additionalProperties === undefined) return `z.object({${body}})`
  throw new Error(`${path}: unsupported additionalProperties form`)
}

// Emit one exported const (with its description as comment lines).
function emitExport(name, node) {
  return [
    ...commentLines(node.description, 0),
    `export const ${name} = ${toZod(node, name)}`,
    '',
  ]
}

// Generate a complete zod module from a parsed YAML schema.
// Every $defs entry becomes a named export; the root becomes `rootName`.
export function generateZodModule({ schema, rootName, sourcePath, note }) {
  if (!rootName) throw new Error('generateZodModule: rootName is required')
  const lines = [
    `// GENERATED from ${sourcePath} by scripts/build-schemas.mjs — DO NOT EDIT.`,
    '// The YAML schema is the single source of truth; regenerate with `npm run build:schemas`.',
    ...(note ? commentLines(note, 0) : []),
    `import { z } from 'zod'`,
    '',
  ]
  for (const [name, node] of Object.entries(schema.$defs || {})) {
    lines.push(...emitExport(name, node))
  }
  const { $defs, ...root } = schema
  lines.push(...emitExport(rootName, root))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}
