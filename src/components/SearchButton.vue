<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const open = ref(false)
const query = ref('')
const results = ref<Array<{ url: string; title: string; excerpt: string }>>([])
let pagefind: any = null

async function ensurePagefind() {
  if (!pagefind) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/pagefind/pagefind.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Pagefind'))
      document.head.appendChild(script)
    })
    pagefind = (window as any).pagefind
    await pagefind?.init()
  }
  return pagefind
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

async function doSearch() {
  if (!query.value.trim()) {
    results.value = []
    return
  }
  const pf = await ensurePagefind()
  const search = await pf.search(query.value)
  const limited = search.results.slice(0, 8)
  results.value = await Promise.all(
    limited.map(async (r: any) => {
      const data = await r.data()
      const title = data?.meta?.title || r.url
      const excerpt = (data?.excerpt || data?.meta?.description || '').replace(/<[^>]+>/g, '').trim()
      return { url: r.url, title, excerpt: excerpt.slice(0, 120) + (excerpt.length > 120 ? '...' : '') }
    })
  )
}

function onInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 200)
}

function openModal() {
  open.value = true
  query.value = ''
  results.value = []
  setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('#mn-search-input')
    input?.focus()
  }, 50)
}

function closeModal() {
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    open.value ? closeModal() : openModal()
  }
  if (e.key === 'Escape' && open.value) closeModal()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 rounded-lg border border-[var(--mn-c-divider)] px-3 py-1.5 text-sm text-[var(--mn-c-text-3)] transition-colors hover:border-[var(--mn-c-brand-1)] hover:text-[var(--mn-c-brand-1)]"
    aria-label="Open search"
    @click="openModal"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
    <span class="hidden sm:inline">Search</span>
    <kbd class="hidden sm:inline text-xs text-[var(--mn-c-text-3)] opacity-60">⌘K</kbd>
  </button>

  <dialog
    v-if="open"
    open
    class="fixed inset-0 z-[200] m-0 h-full w-full max-w-none border-none bg-black/50 p-4 backdrop:items-start backdrop:justify-center"
    @click.self="closeModal"
  >
    <div class="mx-auto mt-[10vh] w-full max-w-2xl rounded-2xl border border-[var(--mn-c-divider)] bg-[var(--mn-c-bg-elv)] p-4 shadow-2xl">
      <input
        id="mn-search-input"
        v-model="query"
        type="search"
        placeholder="Search documentation..."
        class="w-full rounded-lg border border-[var(--mn-c-divider)] bg-[var(--mn-c-bg-soft)] px-4 py-3 text-base text-[var(--mn-c-text-1)] outline-none focus:border-[var(--mn-c-brand-1)]"
        @input="onInput"
      />
      <div v-if="results.length" class="mt-3 max-h-[50vh] overflow-y-auto">
        <a
          v-for="r in results"
          :key="r.url"
          :href="r.url"
          class="block rounded-lg px-4 py-3 transition-colors hover:bg-[var(--mn-c-bg-soft)]"
          @click="closeModal"
        >
          <div class="font-semibold text-[var(--mn-c-brand-1)]">{{ r.title }}</div>
          <div class="mt-0.5 text-sm text-[var(--mn-c-text-3)]">{{ r.excerpt }}</div>
        </a>
      </div>
      <div v-else-if="query" class="mt-4 text-center text-sm text-[var(--mn-c-text-3)]">
        No results found.
      </div>
    </div>
  </dialog>
</template>
