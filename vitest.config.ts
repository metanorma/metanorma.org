import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      '.ssg/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.{ts,mjs}',
    ],
    environment: 'node',
  },
})
