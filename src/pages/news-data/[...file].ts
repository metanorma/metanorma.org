// NewsML-G2 spoke feed (TODO.import-network/03): emits the static
// /news-data/ tree from the mirror collection at build time.
//   /news-data/newsml.xml                        index NewsMessage
//   /news-data/articles/<YYYY-MM-DD>-<slug>/
//     newsml.xml   full NewsItem (inline XHTML from the site's own
//                  renderer + the AsciiDoc source as a rendition)
//     body.adoc    the source rendition
import type { APIRoute, GetStaticPaths } from 'astro'
import { getCollection } from 'astro:content'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildNewsItem, buildNewsMessage } from 'newsmlg2-ts'

const SITE = 'https://www.metanorma.org'
const SPOKE = { id: 'metanorma', name: 'Metanorma' }

interface Emitted {
  date: string
  slug: string          // full stem, e.g. 2026-08-27-commenter-0.3-…
  title: string
  excerpt: string
  authors: string
  bodyHtml: string
  bodyAdoc: string
  canonical: string
}

const isoDate = (v: unknown): string => String(v ?? '').slice(0, 10)

const emittedPosts = async (): Promise<Emitted[]> => {
  const entries = await getCollection('mirror')
  return entries
    .filter((e) => e.id.startsWith('blog/') && e.data.frontmatter?.published !== false)
    .map((e) => {
      const slug = e.id.replace(/^blog\//, '')
      const date = isoDate(e.data.frontmatter?.date) || slug.slice(0, 10)
      const fm = e.data.frontmatter ?? {}
      const authors = Array.isArray(fm.authors)
        ? fm.authors.map((a: any) => a?.name).filter(Boolean).join(', ')
        : ''
      const sourcePath = String(e.data.source ?? '')
      let bodyAdoc = ''
      try {
        bodyAdoc = readFileSync(join(process.cwd(), sourcePath), 'utf8')
      } catch { /* source unavailable; rendition omitted */ }
      return {
        date,
        slug,
        title: String(e.data.title ?? slug),
        excerpt: String(fm.excerpt ?? fm.description ?? ''),
        authors,
        bodyHtml: String(e.data.rendered_html ?? ''),
        bodyAdoc,
        canonical: `${SITE}/blog/${slug}/`,
      }
    })
    .filter((p) => /^\d{4}-\d{2}-\d{2}/.test(p.slug))
    .sort((a, b) => b.date.localeCompare(a.date))
}

const itemModel = (p: Emitted, full: boolean) => ({
  itemMeta: {
    guid: `urn:ribose:news:${p.date}:${SPOKE.id}:${p.slug.replace(/^\d{4}-\d{2}-\d{2}-/, '')}`,
    lang: 'en',
    version: 1,
    itemClass: 'ninat:text',
    provider: { qcode: `nprov:${SPOKE.id}`, name: SPOKE.name },
    canonical: p.canonical,
    versionCreated: `${p.date}T00:00:00+00:00`,
  },
  contentMeta: {
    headline: p.title,
    description: p.excerpt || undefined,
    by: p.authors || SPOKE.name,
    contentCreated: `${p.date}T00:00:00+00:00`,
    ...(full
      ? {
          bodyXhtml: p.bodyHtml,
          renditions: p.bodyAdoc
            ? [{ href: 'body.adoc', rendition: 'rnd:main' }]
            : [],
        }
      : {}),
  },
})

export const getStaticPaths = (async () => {
  const posts = await emittedPosts()
  return [
    { params: { file: 'newsml.xml' } },
    ...posts.flatMap((p) => [
      { params: { file: `articles/${p.slug}/newsml.xml` } },
      ...(p.bodyAdoc ? [{ params: { file: `articles/${p.slug}/body.adoc` } }] : []),
    ]),
  ]
}) satisfies GetStaticPaths

export const GET: APIRoute = async ({ params }) => {
  const file = params.file!
  if (file === 'newsml.xml') {
    const posts = await emittedPosts()
    const xml = buildNewsMessage({
      header: { sent: new Date().toISOString(), sender: 'Ribose' },
      items: posts.map((p) => itemModel(p, false)),
    }).toXml()
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
  }
  const m = file.match(/^articles\/(.+)\/(newsml\.xml|body\.adoc)$/)
  if (!m) return new Response('not found', { status: 404 })
  const [, slug, kind] = m
  const posts = await emittedPosts()
  const post = posts.find((p) => p.slug === slug)
  if (!post) return new Response('not found', { status: 404 })
  if (kind === 'body.adoc') {
    return new Response(post.bodyAdoc, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const xml = buildNewsItem(itemModel(post, true)).toXml()
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
