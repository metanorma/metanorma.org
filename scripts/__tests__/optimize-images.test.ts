import { describe, it, expect } from 'vitest'
import { rewriteImgToPicture, pipelineFor } from '../optimize-images.mjs'

describe('pipelineFor', () => {
  it('maps .png to a lossless palette pipeline', () => {
    expect(pipelineFor('.png')).toMatchObject({
      format: 'png',
      opts: { compressionLevel: 9, palette: true },
    })
  })
  it('maps .jpg and .jpeg to mozjpeg progressive', () => {
    expect(pipelineFor('.jpg')).toMatchObject({ format: 'jpeg', opts: { mozjpeg: true, progressive: true } })
    expect(pipelineFor('.jpeg')).toMatchObject({ format: 'jpeg', opts: { mozjpeg: true, progressive: true } })
  })
  it('maps .webp to quality-82 re-encode', () => {
    expect(pipelineFor('.webp')).toMatchObject({ format: 'webp', opts: { quality: 82 } })
  })
  it('is case-insensitive on the extension', () => {
    expect(pipelineFor('.PNG')).toMatchObject({ format: 'png' })
    expect(pipelineFor('.JPEG')).toMatchObject({ format: 'jpeg' })
  })
  it('returns null for unsupported extensions', () => {
    expect(pipelineFor('.gif')).toBeNull()
    expect(pipelineFor('.svg')).toBeNull()
    expect(pipelineFor('.html')).toBeNull()
    expect(pipelineFor('')).toBeNull()
  })
})

describe('rewriteImgToPicture', () => {
  const webp = new Set(['/assets/foo.webp'])

  it('rewrites a same-origin PNG <img> with a matching WebP', () => {
    const { html, count } = rewriteImgToPicture(
      '<img src="/assets/foo.png" alt="X" loading="lazy" />',
      webp,
    )
    expect(count).toBe(1)
    expect(html).toBe(
      '<picture><source type="image/webp" srcset="/assets/foo.webp"></source>' +
      '<img src="/assets/foo.png" alt="X" loading="lazy" /></picture>'
    )
  })

  it('preserves every original attribute (alt, class, loading, decoding)', () => {
    const { html, count } = rewriteImgToPicture(
      '<img class="hero" src="/assets/foo.png" alt="Hero" loading="lazy" decoding="async" width="100" />',
      webp,
    )
    expect(count).toBe(1)
    expect(html).toContain('class="hero"')
    expect(html).toContain('alt="Hero"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
    expect(html).toContain('width="100"')
  })

  it('handles a self-closing <img /> with no trailing space', () => {
    const { count } = rewriteImgToPicture('<img src="/assets/foo.png"/>', webp)
    expect(count).toBe(1)
  })

  it('handles a non-self-closing <img> tag', () => {
    const { count } = rewriteImgToPicture('<img src="/assets/foo.png">', webp)
    expect(count).toBe(1)
  })

  it('handles JPEGs (.jpg and .jpeg)', () => {
    const webpSet = new Set(['/a/bar.webp'])
    expect(rewriteImgToPicture('<img src="/a/bar.jpg" />', webpSet).count).toBe(1)
    expect(rewriteImgToPicture('<img src="/a/bar.jpeg" />', webpSet).count).toBe(1)
  })

  it('skips external http(s) URLs', () => {
    const webpSet = new Set(['/foo.webp'])
    expect(rewriteImgToPicture(
      '<img src="https://example.com/foo.png" />', webpSet).count).toBe(0)
    expect(rewriteImgToPicture(
      '<img src="http://example.com/foo.png" />', webpSet).count).toBe(0)
  })

  it('skips protocol-relative URLs (//example.com)', () => {
    const webpSet = new Set(['/foo.webp'])
    expect(rewriteImgToPicture(
      '<img src="//example.com/foo.png" />', webpSet).count).toBe(0)
  })

  it('skips images whose WebP variant is not in the set', () => {
    const webpSet = new Set(['/other.webp'])
    expect(rewriteImgToPicture(
      '<img src="/assets/foo.png" />', webpSet).count).toBe(0)
  })

  it('skips SVGs (no WebP rewrite for vector images)', () => {
    const webpSet = new Set(['/logo.webp'])
    expect(rewriteImgToPicture(
      '<img src="/logo.svg" />', webpSet).count).toBe(0)
  })

  it('skips images with no extension', () => {
    const webpSet = new Set(['/foo.webp'])
    expect(rewriteImgToPicture(
      '<img src="/noextension" />', webpSet).count).toBe(0)
  })

  it('rewrites multiple <img> tags in the same HTML string', () => {
    const webpSet = new Set(['/a.webp', '/b.webp'])
    const html = '<p>Before</p>\n<img src="/a.png" alt="A" />\n<img src="/b.jpg" alt="B" />'
    const { count } = rewriteImgToPicture(html, webpSet)
    expect(count).toBe(2)
  })

  it('handles multiple srcset/sizes attributes that contain quotes', () => {
    // The src regex matches src="..." — if there are srcset="..." attrs
    // they shouldn't confuse the src matcher. (No srcset rewrite today.)
    const { count } = rewriteImgToPicture(
      '<img srcset="/a.png 1x" src="/a.png" alt="A" />',
      new Set(['/a.webp']),
    )
    expect(count).toBe(1)
  })

  it('leaves a relative-path image (no leading slash) intact when no WebP set entry matches', () => {
    // Relative path "a/foo.png" → we look up "/a/foo.webp". Set must
    // contain that exact key.
    const webpSet = new Set(['/a/foo.webp'])
    const { count, html } = rewriteImgToPicture('<img src="a/foo.png" />', webpSet)
    expect(count).toBe(1)
    expect(html).toContain('src="/a/foo.png"') // normalized to leading slash
  })

  it('does not rewrite when WebP set is empty', () => {
    const webpSet = new Set<string>()
    const { count } = rewriteImgToPicture(
      '<img src="/assets/foo.png" />', webpSet)
    expect(count).toBe(0)
  })

  it('returns the input string unchanged when nothing matches', () => {
    const original = '<p>No images here.</p>'
    const { html, count } = rewriteImgToPicture(original, new Set(['/x.webp']))
    expect(count).toBe(0)
    expect(html).toBe(original)
  })

  it('handles an empty HTML string', () => {
    const { html, count } = rewriteImgToPicture('', new Set(['/x.webp']))
    expect(count).toBe(0)
    expect(html).toBe('')
  })
})
