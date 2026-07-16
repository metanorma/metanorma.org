export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function unescapeHtml(s: string): string {
  const entities: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
  }
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => entities[e] ?? `&${e};`)
}
