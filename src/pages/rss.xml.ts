import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { posts } from '../data/posts'
import { normalizeDate } from '../lib/blog-date'

export async function GET(context: APIContext) {
  return rss({
    title: 'Metanorma Blog',
    description: 'News, releases, and articles from the Metanorma team.',
    site: context.site || 'https://www.metanorma.org',
    items: posts.map(post => ({
      title: post.title,
      description: post.description,
      pubDate: new Date(normalizeDate(post.date) || post.date),
      link: new URL(post.url, context.site || 'https://www.metanorma.org').toString(),
    })),
    customData: '<language>en-us</language>',
  })
}
