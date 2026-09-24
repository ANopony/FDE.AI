import { defineConfig, devices } from '@playwright/test'

const consoleUrl = process.env.CONSOLE_URL ?? 'http://127.0.0.1:3001'

/**
 * E2E runs against an already running stack (see README "Run the demo"):
 *   runtime : http://127.0.0.1:3000  (FDE_DATABASE_URL, FDE_PLUGIN_ENTRIES,
 *                                     FDE_PLUGIN_AUTOENABLE, FDE_AGENT_MOCK_ENABLED,
 *                                     FDE_DEMO_ENDPOINTS=true)
 *   console : http://127.0.0.1:3001  (pnpm --filter @fde-ai/console dev)
 *
 * Run with: pnpm --filter @fde-ai/tests test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: consoleUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
