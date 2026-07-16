import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..')
const BUILD_DIR = join(SITE_ROOT, 'dist')
const MIRROR_DIR = join(SITE_ROOT, 'mirror-json')
const MANIFEST_PATH = join(MIRROR_DIR, 'manifest.json')
const PAGES_DIR = join(SITE_ROOT, 'pages')

const MIN_BODY_TEXT = 200
const MIN_HUB_CHILDREN = 1
const MIN_MIRROR_TEXT = 300

let pass = 0
let fail = 0
let warnings = 0
const failures = []
const warns = []

function recordFail(check, path, detail) {
  fail++
  failures.push({ check, path, detail })
}

function recordWarn(check, path, detail) {
  warnings++
  warns.push({ check, path, detail })
}

function readHtmlCandidates(urlPath) {
  const stripped = urlPath.replace(/\/$/, '')
  const candidates = [
    join(BUILD_DIR, stripped, 'index.html'),
    join(BUILD_DIR, `${stripped}.html`),
    join(BUILD_DIR, `${urlPath}.html`),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function extractBodyText(html) {
  let body = html
  const article = body.match(/<article[^>]*class="[^"]*mn-page[^"]*"[^>]*>([\s\S]*?)<\/article>/)
  if (article) {
    body = article[1]
  } else {
    const m = body.match(/<body[^>]*>([\s\S]*?)<\/body>/)
    if (!m) return ''
    body = m[1]
  }
  body = body.replace(/<[^>]+>/g, ' ')
  return body.replace(/\s+/g, ' ').trim()
}

function checkManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    console.log('FAIL: No manifest.json. Run convert-adoc.rb first.')
    process.exit(1)
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  const fileMap = manifest.file_map || {}
  const s = manifest.stats || {}

  console.log(`Source: ${s.ok} OK, ${s.cached} CACHED, ${s.fail} FAIL, ${s.empty_hub} EMPTY-HUB, ${s.unmapped} UNMAPPED`)

  console.log('\nPer-page content checks (body text floor = ' + MIN_BODY_TEXT + ' chars):\n')

  for (const [outputKey, info] of Object.entries(fileMap)) {
    if (info.status !== 'ok' && info.status !== 'cached') continue

    const urlPath = `/${outputKey}`
    const htmlPath = readHtmlCandidates(urlPath)

    if (!htmlPath) {
      recordFail('missing', outputKey, `no HTML file for ${info.source}`)
      continue
    }

    const html = readFileSync(htmlPath, 'utf-8')
    const bodyText = extractBodyText(html)

    if (bodyText.length < MIN_BODY_TEXT) {
      recordFail('thin', outputKey, `body ${bodyText.length} < ${MIN_BODY_TEXT} (source: ${info.source})`)
      continue
    }

    pass++
  }

  return manifest
}

function checkKeyPages() {
  const keyPages = [
    { url: '/', name: 'Homepage', minBody: 500 },
    { url: '/flavors/', name: 'Flavors index', minBody: 500 },
    { url: '/flavors/iso', name: 'ISO flavor', minBody: 500 },
    { url: '/blog/', name: 'Blog index', minBody: 500 },
    { url: '/author/', name: 'Author index', minBody: 500 },
    { url: '/develop/', name: 'Develop index', minBody: 500 },
    { url: '/learn/', name: 'Learn index', minBody: 500 },
    { url: '/install/', name: 'Install index', minBody: 500 },
    { url: '/author/ref/', name: 'Reference index', minBody: 500 },
    { url: '/software/', name: 'Software index', minBody: 500 },
    { url: '/library/', name: 'Library index', minBody: 500 },
    { url: '/about', name: 'About', minBody: 500 },
    { url: '/get-started', name: 'Get Started', minBody: 500 },
    { url: '/contribute', name: 'Contribute', minBody: 500 },
  ]

  console.log('\nKey pages (body-text floor = 500 chars):')
  let keyPass = 0
  for (const page of keyPages) {
    const htmlPath = readHtmlCandidates(page.url)
    if (!htmlPath) {
      console.log(`  FAIL: ${page.name} (${page.url}) — no HTML file`)
      recordFail('key_missing', page.url, page.name)
      continue
    }
    const bodyText = extractBodyText(readFileSync(htmlPath, 'utf-8'))
    if (bodyText.length < page.minBody) {
      console.log(`  FAIL: ${page.name} (${page.url}) — body ${bodyText.length} < ${page.minBody}`)
      recordFail('key_thin', page.url, `${page.name}: ${bodyText.length} chars`)
      continue
    }
    keyPass++
    console.log(`  PASS: ${page.name} (${page.url}) — ${bodyText.length} chars`)
  }
  console.log(`  Key pages: ${keyPass}/${keyPages.length}`)
}

function checkBlogIndex() {
  const blogIndexPath = readHtmlCandidates('/blog/')
  if (!blogIndexPath) {
    recordFail('blog_index', '/blog/', 'no blog index HTML')
    return
  }

  const html = readFileSync(blogIndexPath, 'utf-8')
  const titleMatches = Array.from(html.matchAll(/blog-entry-title"[^>]*>([^<]+)</g))
  const titles = titleMatches.map(m => m[1].trim())

  const seen = new Set()
  const duplicates = []
  for (const t of titles) {
    if (seen.has(t)) duplicates.push(t)
    else seen.add(t)
  }
  const numeric = titles.filter(t => /^\d+$/.test(t))

  if (duplicates.length > 0) {
    recordFail('blog_dup', '/blog/', `${duplicates.length} duplicate titles: ${Array.from(new Set(duplicates)).slice(0, 5).join(', ')}`)
  }
  if (numeric.length > 0) {
    recordFail('blog_numeric_title', '/blog/', `${numeric.length} numeric titles (synthesized hub leak?): ${numeric.slice(0, 5).join(', ')}`)
  }

  const postFiles = []
  function walk(dir) {
    if (!existsSync(dir)) return
    for (const e of readdirSync(dir)) {
      const full = join(dir, e)
      if (statSync(full).isDirectory()) walk(full)
      else if (e.endsWith('.md') && e !== 'index.md') postFiles.push(full)
    }
  }
  walk(join(PAGES_DIR, 'blog'))

  if (titles.length !== postFiles.length) {
    recordWarn('blog_count', '/blog/', `index lists ${titles.length} posts, pages/blog/ has ${postFiles.length} .md files`)
  }
}

function checkHubPages(manifest) {
  if (!existsSync(MIRROR_DIR) || !manifest) return
  const fileMap = manifest.file_map || {}
  const synthesized = Object.entries(fileMap).filter(
    ([, info]) => info.source === 'synthesized hub'
  )

  for (const [outputKey] of synthesized) {
    const jsonPath = join(MIRROR_DIR, `${outputKey}.json`)
    if (!existsSync(jsonPath)) {
      recordWarn('hub_missing_json', outputKey, 'synthesized hub has no mirror-json')
      continue
    }
    try {
      const data = JSON.parse(readFileSync(jsonPath, 'utf-8'))
      const mirrorRaw = data.mirror_json
      const mirror = typeof mirrorRaw === 'string' ? JSON.parse(mirrorRaw) : mirrorRaw
      const text = JSON.stringify(mirror)
      const linkCount = (text.match(/"type":"link"/g) || []).length
      const listItemCount = (text.match(/"type":"list_item"/g) || []).length
      if (linkCount < MIN_HUB_CHILDREN && listItemCount < MIN_HUB_CHILDREN) {
        recordFail('hub_empty', outputKey, `synthesized hub has ${linkCount} links / ${listItemCount} list items`)
      }
    } catch (err) {
      recordWarn('hub_parse', outputKey, `failed to parse mirror-json: ${err.message}`)
    }
  }
}

function extractMirrorText(mirror) {
  let text = ''
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (typeof node.text === 'string') text += ' ' + node.text
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(mirror)
  return text.replace(/\s+/g, ' ').trim()
}

function markdownBodyLen(md) {
  const stripped = md.replace(/^---\n[\s\S]*?\n---\n?/, '')
  const noTags = stripped.replace(/<[^>]+>/g, ' ')
  return noTags.replace(/\s+/g, ' ').trim().length
}

function checkThinMirrorJson(manifest) {
  if (!existsSync(MIRROR_DIR) || !manifest) return
  const fileMap = manifest.file_map || {}
  let checked = 0
  let thinCount = 0

  for (const [outputKey, info] of Object.entries(fileMap)) {
    if (info.status !== 'ok' && info.status !== 'cached') continue
    if (info.source === 'synthesized hub') continue
    const jsonPath = join(MIRROR_DIR, `${outputKey}.json`)
    if (!existsSync(jsonPath)) continue
    try {
      const data = JSON.parse(readFileSync(jsonPath, 'utf-8'))
      const mirrorRaw = data.mirror_json
      const mirror = typeof mirrorRaw === 'string' ? JSON.parse(mirrorRaw) : mirrorRaw
      const text = extractMirrorText(mirror)
      checked++

      if (text.length >= MIN_MIRROR_TEXT) continue

      const mdCandidates = [
        join(PAGES_DIR, `${outputKey}.md`),
        join(PAGES_DIR, outputKey, 'index.md'),
      ]
      let shadowedMdLen = 0
      for (const p of mdCandidates) {
        if (!existsSync(p)) continue
        const mdLen = markdownBodyLen(readFileSync(p, 'utf-8'))
        if (mdLen > text.length * 2 && mdLen > MIN_MIRROR_TEXT) {
          shadowedMdLen = mdLen
          break
        }
      }

      thinCount++
      if (shadowedMdLen > 0) {
        recordFail('thin_mirror_shadowed', outputKey, `mirror-json body ${text.length} < ${MIN_MIRROR_TEXT}, hand-authored md body ${shadowedMdLen} ignored (source: ${info.source})`)
      } else {
        recordWarn('thin_mirror', outputKey, `mirror-json body ${text.length} < ${MIN_MIRROR_TEXT} (source: ${info.source})`)
      }
    } catch (err) {
      // hub_parse already warns for parse failures
    }
  }
  console.log(`\nMirror-json thin-content check: ${checked} files checked, ${thinCount} thin`)
}

function checkContentCounts() {
  const counts = {
    author: 0, blog: 0, develop: 0, learn: 0, install: 0,
    reference: 0, specs: 0, samples: 0, software: 0, library: 0, flavors: 0,
  }

  function walkHtml(dir) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walkHtml(full)
      } else if (entry.endsWith('.html')) {
        const rel = full.replace(BUILD_DIR, '').replace(/\/index\.html$/, '').replace(/\.html$/, '')
        for (const prefix of Object.keys(counts)) {
          if (rel === `/${prefix}` || rel.startsWith(`/${prefix}/`)) {
            counts[prefix]++
            break
          }
        }
      }
    }
  }

  walkHtml(BUILD_DIR)

  console.log('\nContent area page counts:')
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([area, count]) => console.log(`  ${area}: ${count} pages`))
}

console.log('=== Metanorma.org Content Verification ===\n')

if (!existsSync(BUILD_DIR)) {
  console.log(`FAIL: No ${relative(SITE_ROOT, BUILD_DIR)}/ directory. Run \`npm run build\` first.`)
  process.exit(1)
}

const manifest = checkManifest()
checkKeyPages()
checkBlogIndex()
checkHubPages(manifest)
checkThinMirrorJson(manifest)
checkContentCounts()

console.log(`\n=== RESULT: ${pass} pass, ${fail} fail, ${warnings} warnings ===`)

if (failures.length > 0) {
  console.log(`\nFailures (${failures.length}):`)
  for (const f of failures.slice(0, 30)) {
    console.log(`  [${f.check}] ${f.path}: ${f.detail}`)
  }
  if (failures.length > 30) console.log(`  ... and ${failures.length - 30} more`)
}

if (warns.length > 0) {
  console.log(`\nWarnings (${warns.length}):`)
  for (const w of warns.slice(0, 15)) {
    console.log(`  [${w.check}] ${w.path}: ${w.detail}`)
  }
  if (warns.length > 15) console.log(`  ... and ${warns.length - 15} more`)
}

process.exit(fail > 0 ? 1 : 0)
