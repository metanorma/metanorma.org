<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

// Mirror of NavigationItem (src/config/site.ts) + FlavorNavGroup
// (src/lib/flavor-groups.ts), redeclared so the island stays decoupled
// from the config module (Astro serializes props across the island
// boundary anyway).
interface NavItem {
  text: string
  link?: string
  mega?: boolean
  items?: NavItem[]
}
interface FlavorGroup {
  label: string
  items: Array<{ label: string; href: string; status?: string }>
}

defineProps<{ nav: NavItem[]; flavorGroups: FlavorGroup[] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}
function close() {
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close()
}

function onClickOutside(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onClickOutside)
  // Close after view-transition navigation (ClientRouter swaps the DOM;
  // a menu left open would otherwise linger over the new page).
  document.addEventListener('astro:after-swap', close)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('astro:after-swap', close)
})
</script>

<template>
  <div ref="root" class="md:hidden">
    <button
      type="button"
      class="inline-flex items-center justify-center rounded-lg border border-[var(--mn-c-divider)] p-1.5 text-[var(--mn-c-text-2)] transition-colors hover:text-[var(--mn-c-brand-1)]"
      :aria-expanded="open"
      aria-controls="mn-mobile-menu"
      aria-label="Toggle navigation menu"
      @click="toggle"
    >
      <svg v-show="!open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
      <svg v-show="open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>

    <div
      v-if="open"
      id="mn-mobile-menu"
      class="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-[var(--mn-c-divider)] bg-[var(--mn-c-bg-elv)] shadow-lg"
    >
      <ul class="px-4 py-2">
        <li v-for="item in nav" :key="item.text" class="border-b border-[var(--mn-c-divider)] last:border-b-0">
          <details v-if="item.items" class="mn-mobile-group">
            <summary class="flex cursor-pointer items-center justify-between py-3 text-sm font-medium text-[var(--mn-c-text-1)]">
              {{ item.text }}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mn-chevron transition-transform"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <ul class="pb-2">
              <li v-for="sub in item.items" :key="sub.text">
                <a
                  :href="sub.link"
                  class="block rounded px-3 py-2 text-sm text-[var(--mn-c-text-2)] no-underline hover:bg-[var(--mn-c-bg-soft)] hover:text-[var(--mn-c-brand-1)]"
                  @click="close"
                >{{ sub.text }}</a>
              </li>
            </ul>
            <template v-if="item.mega">
              <div v-for="group in flavorGroups" :key="group.label" class="pb-2">
                <p class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--mn-c-text-3)]">{{ group.label }}</p>
                <ul>
                  <li v-for="flavor in group.items" :key="flavor.href">
                    <a
                      :href="flavor.href"
                      class="flex items-center gap-2 rounded px-3 py-2 text-sm text-[var(--mn-c-text-2)] no-underline hover:bg-[var(--mn-c-bg-soft)] hover:text-[var(--mn-c-brand-1)]"
                      @click="close"
                    >
                      {{ flavor.label }}
                      <span v-if="flavor.status === 'experimental'" class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-600">Beta</span>
                      <span v-else-if="flavor.status === 'private'" class="rounded bg-[var(--mn-c-bg-mute)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--mn-c-text-3)]">Private</span>
                    </a>
                  </li>
                </ul>
              </div>
            </template>
          </details>
          <a
            v-else
            :href="item.link"
            class="block py-3 text-sm font-medium text-[var(--mn-c-text-1)] no-underline hover:text-[var(--mn-c-brand-1)]"
            @click="close"
          >{{ item.text }}</a>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.mn-mobile-group summary {
  list-style: none;
}
.mn-mobile-group summary::-webkit-details-marker {
  display: none;
}
.mn-mobile-group[open] .mn-chevron {
  transform: rotate(180deg);
}
</style>
