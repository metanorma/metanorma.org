// Pre-generate per-blog-post OG images as static files in dist/og/.
// Posts with frontmatter.card_image are skipped — they keep their own.
//
// Why a build script (not an Astro route): Astro's `trailingSlash: 'always'`
// + binary-content endpoints interact badly — the route produces a file
// with no extension (→ Content-Type: application/octet-stream on static
// hosts), and the URL with trailing slash 404s. A pre-build script that
// writes real .png files into dist/ sidesteps both problems.
//
// Rendering: hand-built SVG (brand gradient + system sans-serif) → PNG
// via sharp. Avoids adding satori/resvg just for this.
//
// The pure helpers (escapeXml, wrap, buildSvg, collectPosts) are
// exported for unit tests; main() only runs when invoked directly.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('../', import.meta.url).pathname
const DIST = join(ROOT, 'dist')
const OG_DIR = join(DIST, 'og')
const MIRROR = join(ROOT, 'mirror-json')

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function wrap(title, maxCharsPerLine = 38, maxLines = 3) {
  const words = title.split(/\s+/)
  const lines = []
  let current = ''
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxCharsPerLine && current) {
      lines.push(current.trim())
      current = w
    } else {
      current = (current + ' ' + w).trim()
    }
  }
  if (current) lines.push(current)
  const truncated = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    const last = truncated[maxLines - 1]
    truncated[maxLines - 1] = last.slice(0, maxCharsPerLine - 1).trimEnd() + '…'
  }
  return truncated
}

export function buildSvg(props) {
  const { title, date, author } = props
  const titleLines = wrap(title)
  const titleStart = 250
  const titleLineHeight = 72
  const titleEls = titleLines.map((line, i) =>
    `      <text x="80" y="${titleStart + i * titleLineHeight}" fill="#FFFFFF" font-family="'Hanken Grotesk', 'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="56" font-weight="800" letter-spacing="-1">${escapeXml(line)}</text>`
  ).join('\n')

  const byline = [date, author].filter(Boolean).map(escapeXml).join('  ·  ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e" />
      <stop offset="55%" stop-color="#1F3D7A" />
      <stop offset="100%" stop-color="#575ABE" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7c60e6" />
      <stop offset="100%" stop-color="#575ABE" />
    </linearGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)" />

  <g opacity="0.08" stroke="#FFFFFF" stroke-width="1" fill="none">
    <line x1="900" y1="80" x2="1180" y2="80" />
    <line x1="900" y1="130" x2="1180" y2="130" />
    <line x1="900" y1="180" x2="1180" y2="180" />
    <line x1="900" y1="80" x2="900" y2="180" />
  </g>

  <rect x="80" y="80" width="64" height="6" rx="3" fill="url(#accent)" />
  <text x="156" y="92" fill="#FFFFFF" font-family="'Hanken Grotesk', 'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="24" font-weight="600" letter-spacing="0.5">Metanorma</text>
  <text x="80" y="130" fill="#B8B4D9" font-family="'Hanken Grotesk', 'Inter', sans-serif" font-size="18" font-weight="500">Standards beyond words</text>

${titleEls}

  ${byline ? `<text x="80" y="540" fill="#B8B4D9" font-family="'Hanken Grotesk', 'Inter', sans-serif" font-size="22" font-weight="500">${byline}</text>` : ''}

  <rect x="0" y="600" width="${OG_WIDTH}" height="30" fill="#0A0A1A" />
  <text x="80" y="620" fill="#8a86a8" font-family="'Space Mono', 'Courier New', monospace" font-size="13">www.metanorma.org/blog/</text>
</svg>`
}

export async function collectPosts({ mirrorRoot = MIRROR } = {}) {
  const blogDir = join(mirrorRoot, 'blog')
  let entries
  try {
    entries = await readdir(blogDir)
  } catch {
    return []
  }
  const out = []
  for (const file of entries) {
    if (!file.endsWith('.json')) continue
    const full = join(blogDir, file)
    let data
    try {
      data = JSON.parse(await readFile(full, 'utf8'))
    } catch {
      continue
    }
    if (data.frontmatter?.card_image) continue
    const slug = file.replace(/\.json$/, '')
    out.push({
      slug,
      title: data.title || '',
      date: data.frontmatter?.date ? String(data.frontmatter.date).slice(0, 10) : '',
      author: data.frontmatter?.author?.name || '',
    })
  }
  return out
}

export async function main() {
  const posts = await collectPosts()
  if (posts.length === 0) {
    console.log('build-og-images: no posts to render')
    return
  }
  await mkdir(OG_DIR, { recursive: true })

  let written = 0
  for (const post of posts) {
    const svg = buildSvg(post)
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
    const outFile = join(OG_DIR, `${post.slug}.png`)
    await mkdir(dirname(outFile), { recursive: true })
    await writeFile(outFile, png)
    written++
  }
  console.log(`build-og-images: ${written} OG images rendered to dist/og/`)
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (invokedDirectly) {
  main().catch(err => { console.error(err); process.exit(1) })
}

