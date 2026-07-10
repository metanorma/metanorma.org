<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { setStoredTheme } from '../lib/theme'

const isDark = ref(false)

function sync() {
  isDark.value = document.documentElement.classList.contains('dark')
}

function toggle() {
  isDark.value = document.documentElement.classList.toggle('dark')
  setStoredTheme(isDark.value ? 'dark' : 'light')
}

onMounted(() => {
  sync()
  document.addEventListener('astro:after-swap', sync)
})

onBeforeUnmount(() => {
  document.removeEventListener('astro:after-swap', sync)
})
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center justify-center rounded-lg border border-[var(--mn-c-divider)] p-1.5 text-[var(--mn-c-text-2)] transition-colors hover:text-[var(--mn-c-brand-1)]"
    :aria-pressed="isDark"
    aria-label="Toggle dark mode"
    title="Toggle theme"
    @click="toggle"
  >
    <svg v-show="!isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
    <svg v-show="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>
</template>
