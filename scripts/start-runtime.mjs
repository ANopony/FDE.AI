/**
 * Quick-start launcher for the FDE.AI runtime.
 *
 *   node scripts/start-runtime.mjs            # PostgreSQL driver (needs FDE_DATABASE_URL)
 *   node scripts/start-runtime.mjs --memory   # in-memory driver, no database required
 *
 * Environment variables set by the caller always win; the defaults below only
 * fill in what is missing, so this stays a convenience wrapper around
 * `node apps/runtime/dist/server.js`.
 */
const memoryDriver = process.argv.includes('--memory')

const defaults = {
  FDE_PLUGIN_ENTRIES: './plugins/examples/test-observer/dist/index.js',
  FDE_PLUGIN_AUTOENABLE: 'test-observer',
  FDE_AGENT_MOCK_ENABLED: 'true',
  FDE_DEMO_ENDPOINTS: 'true',
  FDE_SERVER_PORT: '3000',
}

if (memoryDriver) {
  defaults.FDE_STORE_DRIVER = 'memory'
}

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] = process.env[key] ?? value
}

if (!memoryDriver && !process.env.FDE_DATABASE_URL) {
  console.error(
    'FDE_DATABASE_URL is required for the PostgreSQL driver.\n' +
      'Start a database (docker compose up -d db) and pass FDE_DATABASE_URL, ' +
      'or run `node scripts/start-runtime.mjs --memory` for the in-memory driver.',
  )
  process.exit(1)
}

await import('../apps/runtime/dist/server.js')
