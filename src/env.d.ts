declare module '/pagefind/pagefind.js' {
  interface PagefindSearchResult {
    id: string
    data: () => Promise<string>
    url: string
  }
  interface Pagefind {
    search: (query: string) => Promise<{ results: PagefindSearchResult[] }>
    init: () => void
  }
  const pagefind: Pagefind
  export default pagefind
}
