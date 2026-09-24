import { InMemoryMemoryStore, InMemoryObservationStore } from '@fde-ai/database'
import { InMemoryEventBus } from '@fde-ai/event-bus'
import { buildApp, createRuntime } from '@fde-ai/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/** Task 09 hardening: lifecycle races, duplicate ids, pagination edges, failure states. */

const logger = { debug() {}, info() {}, warn() {}, error() {} }

type HarnessApp = ReturnType<typeof buildApp>

let app: HarnessApp
let runtime: Awaited<ReturnType<typeof createRuntime>>
let observationStore: InMemoryObservationStore

beforeEach(async () => {
  observationStore = new InMemoryObservationStore()
  const memoryStore = new InMemoryMemoryStore()
  runtime = await createRuntime({
    logger,
    eventBus: new InMemoryEventBus({ logger }),
    observationStore,
    memoryStore,
  })
  app = buildApp({
    observationService: runtime.observationService,
    memoryService: runtime.memoryService,
    timelineService: runtime.timelineService,
    pluginRegistry: runtime.registry,
    logger: false,
  })
})

afterEach(async () => {
  await app.close()
})

async function emitObservation(overrides: Record<string, unknown> = {}): Promise<string> {
  const observation = await runtime.observationService.emit({
    pluginId: 'test-observer',
    sourceId: 'test.source',
    type: 'test.observation',
    payload: { stage: 'lead' },
    ...overrides,
  })
  return observation.id
}

describe('lifecycle race conditions', () => {
  it('rejects a concurrent enable while the first one is still starting', async () => {
    let releaseStart: (() => void) | undefined
    const started: string[] = []
    runtime.registry.register({
      manifest: { id: 'slow-plugin', name: 'Slow Plugin', version: '0.1.0' },
      start: async () => {
        started.push('start')
        await new Promise<void>((resolve) => {
          releaseStart = resolve
        })
      },
    })

    const firstEnable = runtime.registry.enable('slow-plugin')
    await expect(runtime.registry.enable('slow-plugin')).rejects.toThrow(/busy|not allowed/)
    await expect(runtime.registry.disable('slow-plugin')).rejects.toThrow(/busy|not allowed/)

    releaseStart?.()
    await firstEnable

    expect(started).toEqual(['start'])
    expect(runtime.registry.getStatus('slow-plugin')).toBe('enabled')
  })
})

describe('duplicate ids', () => {
  it('generates unique observation ids and rejects duplicate inserts', async () => {
    const ids = new Set<string>()
    for (let index = 0; index < 5; index += 1) {
      ids.add(await emitObservation())
    }
    expect(ids.size).toBe(5)

    const existing = await observationStore.get([...ids][0] as string)
    expect(existing).toBeDefined()
    await expect(observationStore.insert(existing!)).rejects.toThrow(/duplicate observation id/)
  })

  it('rejects a memory revision that does not follow the current revision', async () => {
    const memoryStore = new InMemoryMemoryStore()
    const memory = {
      id: 'mem_stale',
      type: 'opportunity',
      content: { stage: 'lead' },
      sourceEventIds: ['obs_1'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      revision: 1,
    }
    const revision = {
      id: 'rev_1',
      memoryId: 'mem_stale',
      revision: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      sourceEventIds: ['obs_1'],
      before: null,
      after: memory.content,
      diff: { changed: [], added: [], removed: [] },
    }
    await memoryStore.createWithRevision(memory, revision)
    await expect(
      memoryStore.updateWithRevision({ ...memory, revision: 5 }, { ...revision, id: 'rev_5', revision: 5 }),
    ).rejects.toThrow(/stale revision/)
  })
})

describe('pagination boundaries', () => {
  it('walks every page exactly once and stops at the end', async () => {
    for (let index = 0; index < 5; index += 1) {
      await emitObservation({ timestamp: `2026-01-0${index + 1}T10:00:00.000Z` })
    }

    const seen: string[] = []
    let cursor: string | undefined
    for (let page = 0; page < 10; page += 1) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/timeline?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      })
      expect(response.statusCode).toBe(200)
      const body = response.json<{ items: Array<{ id: string }>; nextCursor?: string }>()
      seen.push(...body.items.map((item) => item.id))
      cursor = body.nextCursor
      if (!cursor) break
    }

    expect(seen).toHaveLength(5)
    expect(new Set(seen).size).toBe(5)
  })

  it('treats a malformed or out-of-range cursor as the end of the data', async () => {
    await emitObservation()

    const malformed = await app.inject({ method: 'GET', url: '/api/timeline?cursor=not-a-cursor' })
    expect(malformed.statusCode).toBe(200)
    expect(malformed.json<{ items: unknown[] }>().items).toHaveLength(1)

    const beyondEnd = await app.inject({ method: 'GET', url: '/api/timeline?cursor=o%3D99%3Br%3D99' })
    expect(beyondEnd.statusCode).toBe(200)
    expect(beyondEnd.json<{ items: unknown[]; nextCursor?: string }>()).toMatchObject({ items: [] })
  })

  it('validates limit bounds', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/timeline?limit=0' })).statusCode).toBe(400)
    expect((await app.inject({ method: 'GET', url: '/api/timeline?limit=999' })).statusCode).toBe(400)
    expect((await app.inject({ method: 'GET', url: '/api/timeline?limit=200' })).statusCode).toBe(200)
  })
})

describe('failure states', () => {
  it('surfaces plugin start failures and counts them without crashing the API', async () => {
    runtime.registry.register({
      manifest: { id: 'broken-plugin', name: 'Broken Plugin', version: '0.1.0' },
      start: () => {
        throw new Error('observer could not start')
      },
    })

    const enable = await app.inject({ method: 'POST', url: '/api/plugins/broken-plugin/enable' })
    expect(enable.statusCode).toBe(500)

    const detail = await app.inject({ method: 'GET', url: '/api/plugins/broken-plugin' })
    expect(detail.json<Record<string, unknown>>()).toMatchObject({
      status: 'error',
      errorCount: 1,
      lastError: 'observer could not start',
    })

    // the rest of the API keeps working
    await emitObservation()
    const timeline = await app.inject({ method: 'GET', url: '/api/timeline' })
    expect(timeline.statusCode).toBe(200)
  })

  it('rejects invalid memory mutations', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/demo/observations',
      payload: { payload: {} },
    })
    // demo endpoint is not registered in this harness
    expect(invalid.statusCode).toBe(404)

    const memory = await runtime.memoryService.create({
      type: 'opportunity',
      content: { stage: 'lead' },
      sourceEventIds: ['obs_1'],
    })
    await expect(runtime.memoryService.update(memory.id, {})).rejects.toThrow(/at least one/)
    await expect(runtime.memoryService.create({ type: 'x', content: {}, sourceEventIds: [] })).rejects.toThrow()
  })
})
