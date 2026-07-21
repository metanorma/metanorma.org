// Test stub for the 'astro:content' virtual module.
//
// Aliased in vitest.config.ts so tests can import the REAL
// src/content.config.ts and validate loader output against the REAL
// zod schema. Astro itself never sees this file — the alias only
// applies under vitest.
import { z } from 'zod'

// Astro's defineCollection is identity at the value level: it returns
// the collection config (loader + schema) it was given.
export function defineCollection<T>(config: T): T {
  return config
}

export { z }
