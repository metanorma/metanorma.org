// URL canonicalization for the metanorma.org build pipeline.
//
// The build has three places that turn some build artifact into a URL:
//   - scripts/convert/path_mapping.rb (Ruby): source .adoc path → output key
//   - .ssg/router.ts (TS):                output key → URL
//   - scripts/build-redirects.mjs (JS):   pages/**/*.md path → URL
//
// The Ruby mapping handles source-specific special cases (blog date prefix,
// _pages/* install/, reference_docs/Ref-* prefix stripping, etc.) and is
// not duplicated elsewhere. The TS and JS sides only canonicalize an
// already-derived output key / .md path into a URL — those are the rules
// extracted here so the canonicalization lives in one place.

export function outputKeyToUrl(key) {
  const stripped = String(key).replace(/\/index$/, '/')
  return stripped.startsWith('/') ? stripped : '/' + stripped
}

export function pagesPathToUrl(relPath) {
  const normalized = String(relPath).replace(/\\/g, '/')
  const noExt = normalized.replace(/\.md$/, '')
  const noIndex = noExt.replace(/(^|\/)index$/, '$1')
  return noIndex.startsWith('/') ? noIndex : '/' + noIndex
}
