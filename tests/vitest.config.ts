import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Playwright specs live in e2e/ and are run with `pnpm test:e2e`.
    include: ['integration/**/*.test.ts'],
  },
})
