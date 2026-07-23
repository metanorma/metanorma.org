// Post-build image optimization. Two passes:
//
//   1. Re-encode each PNG/JPEG/WebP in dist/ using sharp. Output replaces
//      the original in place ONLY when strictly smaller — already-optimal
//      images are skipped. (PNGs go through lossless palette + zlib level
//      9; JPEGs through mozjpeg q=82 progressive.)
//   2. Generate a WebP variant (q=80) for each PNG/JPEG > 100KB. Then
//      walk every built HTML file and rewrite <img src="*.png|jpg|jpeg">
//      to <picture><source type="image/webp" srcset="…webp"><img …></picture>
//      so browsers negotiate format with a fallback. (WebP is typically
//      4–8× smaller than PNG for photographic content.)
//
// Why post-build: source images in public/ are immutable per project
// policy. dist/ is regenerated on every build, so writing there is
// non-destructive.
//
// Skips: SVG (already vector), GIF (animation), files whose content
// doesn't match their extension (silent warning, no exit).

import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, extname, dirname, basename } from 'node:path'
import sharp from 'sharp'

const DIST = new URL('../dist/', import.meta.url).pathname
const WEBP_THRESHOLD = 100 * 1024 // only emit WebP for originals larger than this
const CONCURRENCY = 8

const STATS = {
  scanned: 0, recompressed: 0, skipped: 0, webpGenerated: 0, webpSkipped: 0,
  htmlRewritten: 0, imgsRewritten: 0, bytesIn: 0, bytesOut: 0, errored: 0,
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(full))
    else out.push(full)
  }
  return out
}

export function pipelineFor(ext) {
  switch (ext.toLowerCase()) {
    case '.png':  return { format: 'png',  opts: { compressionLevel: 9, palette: true } }
    case '.jpg':
    case '.jpeg': return { format: 'jpeg', opts: { quality: 82, mozjpeg: true, progressive: true } }
    case '.webp': return { format: 'webp', opts: { quality: 82 } }
    default: return null
  }
}

async function optimizeOne(filePath) {
  const ext = extname(filePath).toLowerCase()
  const pipe = pipelineFor(ext)
  if (!pipe) return
  STATS.scanned++

  let meta
  try {
    meta = await sharp(filePath).metadata()
  } catch (err) {
    STATS.errored++
    return
  }
  if (meta.format !== pipe.format && !(meta.format === 'jpeg' && pipe.format === 'jpeg')) {
    // File contents don't match the extension (e.g. an HTML file misnamed
    // .png upstream). Skip silently — the warning floods logs and we
    // can't fix it from here.
    STATS.errored++
    return
  }

  const before = (await stat(filePath)).size
  STATS.bytesIn += before

  // Pass 1: re-encode in place if smaller.
  try {
    const buf = await sharp(filePath)[pipe.format](pipe.opts).toBuffer()
    if (buf.length < before) {
      await writeFile(filePath, buf)
      STATS.recompressed++
      STATS.bytesOut += buf.length
    } else {
      STATS.skipped++
      STATS.bytesOut += before
    }
  } catch {
    STATS.skipped++
    STATS.bytesOut += before
  }

  // Pass 2: emit a WebP variant for large rasters (PNG/JPEG only —
  // WebP-from-WebP is pointless).
  if (ext === '.webp') return
  if (before < WEBP_THRESHOLD) { STATS.webpSkipped++; return }
  const webpPath = filePath.slice(0, -ext.length) + '.webp'
  try {
    const webpBuf = await sharp(filePath).webp({ quality: 80 }).toBuffer()
    // Only ship the WebP variant if it's at least 25% smaller than the
    // (possibly already-recompressed) original — otherwise the
    // <picture> rewrite adds weight for nothing.
    const currentSize = (await stat(filePath)).size
    if (webpBuf.length < currentSize * 0.75) {
      await writeFile(webpPath, webpBuf)
      STATS.webpGenerated++
    } else {
      STATS.webpSkipped++
    }
  } catch {
    STATS.webpSkipped++
  }
}

const IMG_TAG = /<img\b([^>]*?)\s+src="([^"]+)"([^>]*)\/?>/gi

// Pure HTML rewriter: takes a string of HTML and a Set of WebP URL paths,
// returns the rewritten HTML + a count. Extracted for unit testing.
export function rewriteImgToPicture(html, webpSet) {
  let count = 0
  const next = html.replace(IMG_TAG, (whole, pre, srcRaw, post) => {
    if (/^https?:\/\//.test(srcRaw) || srcRaw.startsWith('//')) return whole
    const src = srcRaw.replace(/^\/+/, '')
    const dot = src.lastIndexOf('.')
    if (dot < 0) return whole
    const ext = src.slice(dot).toLowerCase()
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') return whole
    const webp = '/' + src.slice(0, dot) + '.webp'
    if (!webpSet.has(webp)) return whole
    const originalSrc = srcRaw.startsWith('/') ? srcRaw : '/' + srcRaw
    count++
    return `<picture><source type="image/webp" srcset="${webp}"></source><img${pre} src="${originalSrc}"${post}></picture>`
  })
  return { html: next, count }
}

async function rewriteHtml(filePath, webpSet) {
  const html = await readFile(filePath, 'utf8')
  const { html: next, count } = rewriteImgToPicture(html, webpSet)
  if (count > 0) {
    await writeFile(filePath, next)
    STATS.htmlRewritten++
    STATS.imgsRewritten += count
  }
}

async function worker(queue, fn) {
  while (queue.length) {
    const item = queue.shift()
    if (item !== undefined) await fn(item)
  }
}

async function main() {
  const all = await walk(DIST)
  const images = all.filter(f => {
    const ext = extname(f).toLowerCase()
    return ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp'
  })

  // Pass 1+2 over images, parallelized.
  const queue = [...images]
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue, optimizeOne)))

  // Re-walk dist/ — Pass 2 may have emitted new .webp files. The webpSet
  // must reflect what's on disk NOW, not what existed before optimization.
  const after = await walk(DIST)
  const webpSet = new Set(
    after
      .filter(f => f.endsWith('.webp'))
      .map(f => '/' + f.slice(DIST.length).replace(/^\/+/, ''))
  )

  // Pass 3: HTML <img> → <picture> rewrite.
  const htmlFiles = after.filter(f => f.endsWith('.html'))
  const htmlQueue = [...htmlFiles]
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(htmlQueue, (f) => rewriteHtml(f, webpSet))))

  const saved = STATS.bytesIn - STATS.bytesOut
  const fmt = (b) => (b / 1024 / 1024).toFixed(2) + ' MB'
  const pct = ((saved / (STATS.bytesIn || 1)) * 100).toFixed(1)
  console.log(
    `optimize-images: ${STATS.recompressed}/${STATS.scanned} re-encoded ` +
    `(${STATS.skipped} already optimal, ${STATS.errored} unreadable); ` +
    `${STATS.webpGenerated} WebP variants (${STATS.webpSkipped} skipped); ` +
    `${STATS.imgsRewritten} <img>→<picture> across ${STATS.htmlRewritten} pages; ` +
    `saved ${fmt(saved)} (${pct}%)`
  )
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (invokedDirectly) {
  main().catch(err => { console.error(err); process.exit(1) })
}
