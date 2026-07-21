// TypeScript mirror of Convert::PathMapping.kebab_segment / kebab_path
// (scripts/convert/path_mapping.rb) — THE kebab implementation on the
// site side, exactly as kebab_segment is THE implementation on the
// converter side. Every snake_case → kebab-case conversion in the site
// pipeline goes through here.
//
// PARITY: the behavior table for these two functions is pinned by
// table-driven specs on BOTH sides — src/lib/__tests__/kebab.test.ts
// and spec/convert/path_mapping_spec.rb. Keep the tables in sync.

// snake_case → kebab-case for a single path segment. Case is preserved
// (YAML_models → YAML-models), exactly like Ruby's String#tr("_", "-").
export function kebabSegment(segment: string): string {
  return segment.replace(/_/g, '-')
}

// Kebab every segment of a slash-separated path.
export function kebabPath(path: string): string {
  return path.split('/').map(kebabSegment).join('/')
}
