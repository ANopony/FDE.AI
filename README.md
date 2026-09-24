# FDE.AI

> AI as FDE — an AI Agent that works like an FDE to understand customers' work and discover opportunities for optimization, automation, and AI enhancement.

## Vision

FDE.AI acts as a **general-purpose FDE**.

It enters a customer's business environment, continuously observes how people work, understands roles, tasks, processes, systems, and problems, and gradually builds a structured understanding of the business.

Most of this process is **unobtrusive**. The Agent only actively interacts when it needs clarification or confirmation that cannot be reliably obtained from observation.

## Core Loop

```text
Customer Work
    ↓
Silent Observation
    ↓
Understand & Store Memory
    ↓
Daily Review
    ↓
Daily Ask (when needed)
    ↓
Long-term Accumulation
    ↓
Discover Patterns / Problems
    ↓
Generate Optimization Opportunities
    ↓
Customer Review
    ↓
Implementation / Automation / AI
    ↓
Continue Observation
```

## Architecture

```text
                         ┌────────────────────┐
                         │      FDE.AI        │
                         │     Core Agent     │
                         │ Understand / Plan   │
                         │ Reason / Orchestrate│
                         └─────────┬──────────┘
                                   │
                   ┌───────────────┼───────────────┐
                   ↓               ↓               ↓
              Perception         Memory         Reasoning
                   │               │               │
                   └───────────────┼───────────────┘
                                   ↓
                              Plugins
       Chat · Document · Process · Knowledge · Data · System · Domain
```

The **Core Agent** is the central intelligence. Supporting capabilities are implemented as **pluggable modules** that can be added or replaced according to the customer and scenario.

## Key Principles
deeps
- **Silent by default** — most perception and memory building happens without interrupting the customer.
- **Ask selectively** — Daily Ask is used only when clarification materially improves understanding.
- **Memory first** — optimization decisions are based on accumulated evidence over time.
- **Long-term discovery** — opportunities emerge from repeated patterns, bottlenecks, exceptions, and inefficiencies.
- **Plugin-based** — specialized capabilities remain modular and replaceable.

## Status

Phase 1 — Runtime & Observability MVP. The full chain is implemented and demonstrable:

```text
Plugin -> Observation -> Agent Event (mock) -> Memory -> Memory Revision/Diff -> Timeline
```

Implemented: Plugin Runtime (manifest, registry, lifecycle), Event Bus, Observation runtime
(PostgreSQL + Drizzle), Memory Core with revisions and readable diffs, Timeline query API,
Plugin Management API, Memory Viewer UI, Timeline UI, Console shell.

### Project layout

```text
apps/runtime      Fastify runtime: plugin registry, observations, memory, timeline, REST API
apps/console      Next.js Console: Plugins / Memory / Timeline views
packages/domain   Framework-free domain contracts (Zod schemas + types)
packages/event-bus        In-process EventBus (interface lives in domain)
packages/database         Drizzle/PostgreSQL stores + in-memory stores for demos/tests
packages/api-client       Typed REST client used by the Console
plugins/examples/*        Example plugins (demo-observer, test-observer)
tests/integration         Vitest integration tests (full loop + hardening)
tests/e2e                 Playwright demo flow
scripts/demo              One-command demo (no database required)
```

### Prerequisites

- Node.js >= 20 (developed on 24), pnpm >= 10
- PostgreSQL 16 — optional: `FDE_STORE_DRIVER=memory` runs the whole stack without a database
  (docker compose is only needed for the persistent driver)

### Install

```bash
pnpm install
pnpm build        # builds every package (turbo, includes next build)
```

### Run the demo without a database

```bash
pnpm demo         # = node scripts/demo/run-demo.mjs
```

It prints all 13 steps of the Phase 1 demo: plugin enabled, observation emitted, mock agent
processing, memory created/updated, revision diffs, timeline chain, plugin disabled and no
further observations.

### Run the full stack locally

```bash
pnpm build

# runtime (Fastify on :3000). Omit FDE_STORE_DRIVER to use PostgreSQL instead.
FDE_STORE_DRIVER=memory \
FDE_PLUGIN_ENTRIES=./plugins/examples/test-observer/dist/index.js \
FDE_AGENT_MOCK_ENABLED=true \
FDE_DEMO_ENDPOINTS=true \
node apps/runtime/dist/server.js

# console (Next.js on :3001, proxies /api/* to the runtime)
pnpm --filter @fde-ai/console start     # production build; use `dev` while developing
```

With PostgreSQL instead of the in-memory driver:

```bash
docker compose up -d db                       # PostgreSQL 16 on :5432
FDE_DATABASE_URL=postgres://fde:fde@localhost:5432/fde node apps/runtime/dist/server.js
```

If port 5432 is unavailable (some Windows setups reserve it — check with
`netsh interface ipv4 show excludedportrange protocol=tcp`), pick another host port:

```bash
FDE_DB_PORT=5544 docker compose up -d db
FDE_DATABASE_URL=postgres://fde:fde@localhost:5544/fde node apps/runtime/dist/server.js
```

Open http://127.0.0.1:3001, enable the plugin on the Plugins page, then trigger an observation:

```bash
curl -X POST http://127.0.0.1:3000/api/demo/observations \
  -H 'content-type: application/json' \
  -d '{"payload":{"customer":"Acme","stage":"lead"}}'
```

### Environment variables

Env vars are mapped to dotted config keys: lowercase the name without the `FDE_` prefix and
replace `_` with `.` (e.g. `FDE_PLUGIN_AUTOENABLE` → `plugin.autoenable`).

| Variable | Purpose | Default |
|---|---|---|
| `FDE_STORE_DRIVER` | `postgres` or `memory` | `postgres` |
| `FDE_DATABASE_URL` | PostgreSQL connection string | required for the `postgres` driver |
| `FDE_SERVER_PORT` / `FDE_SERVER_HOST` | REST API bind address | `3000` / `127.0.0.1` |
| `FDE_PLUGIN_ENTRIES` | Comma-separated plugin module paths (resolved against the working directory) | empty |
| `FDE_PLUGIN_AUTOENABLE` | Plugin ids (or `*`) enabled at startup | empty |
| `FDE_AGENT_MOCK_ENABLED` | Start the mock agent processor | `false` |
| `FDE_DEMO_ENDPOINTS` | Enable `POST /api/demo/observations` | `false` |
| `RUNTIME_URL` (console) | Runtime base URL for the `/api` proxy | `http://127.0.0.1:3000` |

### API

```text
GET  /api/health
GET  /api/plugins                 GET  /api/plugins/:id
POST /api/plugins/:id/enable      POST /api/plugins/:id/disable
GET  /api/observations/:id
GET  /api/memories                GET  /api/memories/:id
GET  /api/memories/:id/revisions
GET  /api/timeline                (from/to/kind/pluginId/sourceId/memoryId/limit/cursor)
POST /api/demo/observations       (dev harness, opt-in)
```

### Tests

```bash
pnpm typecheck     # every package (tsc --noEmit, tests included)
pnpm lint          # eslint
pnpm test          # vitest: unit + integration + Drizzle SQL layer on PGlite

# additionally run the same SQL layer against a real PostgreSQL server
TEST_DATABASE_URL=postgres://fde:fde@localhost:5432/fde pnpm test

# E2E against a running stack (browsers are downloaded once)
pnpm --filter @fde-ai/tests exec playwright install chromium
pnpm test:e2e
```

The E2E drives the Console against a running runtime; start the stack as described above and
**restart the runtime between runs** when it uses the in-memory driver, because the demo flow
expects an empty store (it merges into an existing opportunity memory otherwise).

