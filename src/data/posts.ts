import { normalizeDate } from '../lib/blog-date'
import { readAllEnvelopes } from '../lib/mirror-store'

export interface BlogPost {
  title: string
  url: string
  date: string
  description: string
}

function dateFromUrl(url: string): string | undefined {
  const m = url.match(/\/blog\/(\d{4})-(\d{2})-(\d{2})-/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined
}

const envelopes = await readAllEnvelopes()

export const posts: BlogPost[] = envelopes
  .filter(e => e.slug.startsWith('blog/') && e.frontmatter.title)
  .map(e => {
    const slug = e.slug.replace(/^blog\//, '')
    const url = slug === 'index' ? '/blog/' : `/blog/${slug}/`
    return {
      title: String(e.frontmatter.title || ''),
      url,
      date: normalizeDate(e.frontmatter.date) || dateFromUrl(url) || '',
      description: String(e.frontmatter.description || e.frontmatter.excerpt || ''),
    }
  })
  .filter(p => p.title && p.url !== '/blog/')
  .sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return db - da
  })

export const data = posts
