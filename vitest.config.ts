import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      // Let tests import the real src/content.config.ts (which imports
      // the 'astro:content' virtual module) outside of Astro.
      'astro:content': fileURLToPath(new URL('./src/__tests__/stubs/astro-content.ts', import.meta.url)),
    },
  },
  test: {
    include: [
      'src/**/__tests__/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.{ts,mjs}',
    ],
    environment: 'node',
  },
})
