import type { Logger, Plugin } from '@fde-ai/domain'
import { describe, expect, it } from 'vitest'
import { DefaultMemoryService, InMemoryEventBus, buildApp, createRuntime } from '../../src/index.js'
import { FakeMemoryStore, FakeObservationStore } from '../helpers/fakes.js'

const logger: Logger = { debug() {}, info() {}, warn() {}, error() {} }

function makePlugin(id: string, overrides: Partial<Plugin> = {}): Plugin {
  return { manifest: { id, name: id, version: '0.1.0' }, ...overrides }
}

async function makeApp() {
  const observationStore = new FakeObservationStore()
  const memoryStore = new FakeMemoryStore()
  const eventBus = new InMemoryEventBus({ logger })
  const memoryService = new DefaultMemoryService({
    store: memoryStore,
    bus: eventBus,
    logger,
    now: () => '2026-01-01T11:00:00.000Z',
  })
  const runtime = await createRuntime({
    logger,
    eventBus,
    observationStore,
    memoryStore,
    memoryService,
  })
  runtime.registry.register(makePlugin('good-plugin'))
  runtime.registry.register(
    makePlugin('bad-plugin', {
      start: () => {
        throw new Error('start exploded')
      },
    }),
  )
  const app = buildApp({
    observationService: runtime.observationService,
    memoryService: runtime.memoryService,
    timelineService: runtime.timelineService,
    pluginRegistry: runtime.registry,
    logger: false,
  })
  return { app, runtime }
}

describe('Plugin Management API', () => {
  it('lists registered plugins with capabilities and counters', async () => {
    const { app } = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/plugins' })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ plugins: Array<Record<string, unknown>> }>()
    expect(body.plugins.map((p) => p.id)).toEqual(['good-plugin', 'bad-plugin'])
    expect(body.plugins[0]).toMatchObject({ status: 'registered', errorCount: 0, capabilities: {} })
  })

  it('returns plugin detail with lifecycle timestamps', async () => {
    const { app } = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/plugins/good-plugin' })

    expect(res.statusCode).toBe(200)
    const body = res.json<Record<string, unknown>>()
    expect(body.manifest).toMatchObject({ id: 'good-plugin' })
    expect(body.lifecycle).toMatchObject({ registeredAt: expect.any(String) })
  })

  it('enable -> disable -> enable runs the real lifecycle and is idempotent', async () => {
    const { app } = await makeApp()

    const firstEnable = await app.inject({ method: 'POST', url: '/api/plugins/good-plugin/enable' })
    expect(firstEnable.statusCode).toBe(200)
    expect(firstEnable.json()).toMatchObject({ status: 'enabled' })

    const again = await app.inject({ method: 'POST', url: '/api/plugins/good-plugin/enable' })
    expect(again.statusCode).toBe(200)
    expect(again.json()).toMatchObject({ status: 'enabled' })

    const disable = await app.inject({ method: 'POST', url: '/api/plugins/good-plugin/disable' })
    expect(disable.statusCode).toBe(200)
    expect(disable.json()).toMatchObject({ status: 'disabled' })

    const disableAgain = await app.inject({ method: 'POST', url: '/api/plugins/good-plugin/disable' })
    expect(disableAgain.json()).toMatchObject({ status: 'disabled' })

    const detail = await app.inject({ method: 'GET', url: '/api/plugins/good-plugin' })
    expect(detail.json<Record<string, unknown>>().status).toBe('disabled')
  })

  it('returns 404 for unknown plugins', async () => {
    const { app } = await makeApp()

    const detail = await app.inject({ method: 'GET', url: '/api/plugins/nope' })
    expect(detail.statusCode).toBe(404)

    const enable = await app.inject({ method: 'POST', url: '/api/plugins/nope/enable' })
    expect(enable.statusCode).toBe(404)
  })

  it('returns 500 for plugin runtime errors and counts them', async () => {
    const { app } = await makeApp()

    const enable = await app.inject({ method: 'POST', url: '/api/plugins/bad-plugin/enable' })
    expect(enable.statusCode).toBe(500)

    const detail = await app.inject({ method: 'GET', url: '/api/plugins/bad-plugin' })
    const body = detail.json<Record<string, unknown>>()
    expect(body.status).toBe('error')
    expect(body.errorCount).toBe(1)
    expect(body.lastError).toContain('start exploded')
  })
})

describe('Timeline & detail API', () => {
  it('serves a mixed timeline and detail endpoints', async () => {
    const { app, runtime } = await makeApp()

    await runtime.observationService.emit({
      pluginId: 'test-observer',
      sourceId: 'test.source',
      type: 'test.observation',
      timestamp: '2026-01-01T10:00:00.000Z',
      payload: { n: 1 },
    })
    await runtime.observationService.emit({
      pluginId: 'test-observer',
      sourceId: 'test.source',
      type: 'test.observation',
      timestamp: '2026-01-01T12:00:00.000Z',
      payload: { n: 2 },
    })
    const memory = await runtime.memoryService.create({
      type: 'opportunity',
      content: { stage: 'lead' },
      sourceEventIds: ['obs_x'],
      reason: 'demo',
    })

    const timeline = await app.inject({ method: 'GET', url: '/api/timeline' })
    expect(timeline.statusCode).toBe(200)
    const body = timeline.json<{ items: Array<Record<string, unknown>> }>()
    expect(body.items).toHaveLength(3)
    expect(body.items.map((i) => i.kind)).toEqual(['observation', 'memory_change', 'observation'])

    const onlyMemory = await app.inject({ method: 'GET', url: '/api/timeline?kind=memory_change' })
    expect(onlyMemory.json<{ items: unknown[] }>().items).toHaveLength(1)

    // Timeline detail expansion: observation detail carries plugin/source/payload
    const observationItem = body.items.find((item) => item.kind === 'observation') as { id: string }
    const observationDetail = await app.inject({ method: 'GET', url: `/api/observations/${observationItem.id}` })
    expect(observationDetail.statusCode).toBe(200)
    expect(observationDetail.json<Record<string, unknown>>()).toMatchObject({
      pluginId: 'test-observer',
      sourceId: 'test.source',
      type: 'test.observation',
      correlationId: expect.any(String),
    })

    const missingObservation = await app.inject({ method: 'GET', url: '/api/observations/missing' })
    expect(missingObservation.statusCode).toBe(404)

    const memoryDetail = await app.inject({ method: 'GET', url: `/api/memories/${memory.id}` })
    expect(memoryDetail.statusCode).toBe(200)
    expect(memoryDetail.json<{ id: string }>().id).toBe(memory.id)

    const revisions = await app.inject({ method: 'GET', url: `/api/memories/${memory.id}/revisions` })
    expect(revisions.statusCode).toBe(200)
    expect(revisions.json<{ items: unknown[] }>().items).toHaveLength(1)

    const missing = await app.inject({ method: 'GET', url: '/api/memories/missing/revisions' })
    expect(missing.statusCode).toBe(404)
  })

  it('validates timeline query input', async () => {
    const { app } = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/timeline?kind=bogus' })
    expect(res.statusCode).toBe(400)
  })
})

describe('Memory API', () => {
  it('lists memories with type filter and pagination metadata', async () => {
    const { app, runtime } = await makeApp()
    await runtime.memoryService.create({
      type: 'opportunity',
      content: { stage: 'lead' },
      sourceEventIds: ['obs_1'],
    })
    await runtime.memoryService.create({
      type: 'customer',
      content: { name: 'Acme' },
      sourceEventIds: ['obs_2'],
    })

    const all = await app.inject({ method: 'GET', url: '/api/memories' })
    expect(all.statusCode).toBe(200)
    expect(all.json<{ items: unknown[] }>().items).toHaveLength(2)

    const filtered = await app.inject({ method: 'GET', url: '/api/memories?type=customer' })
    const items = filtered.json<{ items: Array<{ type: string }> }>().items
    expect(items.map((m) => m.type)).toEqual(['customer'])
  })

  it('exposes revision history and diff through the API', async () => {
    const { app, runtime } = await makeApp()
    const memory = await runtime.memoryService.create({
      type: 'opportunity',
      content: { stage: 'lead' },
      sourceEventIds: ['obs_1'],
    })
    await runtime.memoryService.update(memory.id, {
      content: { stage: 'negotiation' },
      sourceEventIds: ['obs_2'],
      reason: 'stage changed',
    })

    const res = await app.inject({ method: 'GET', url: `/api/memories/${memory.id}/revisions` })
    const items = res.json<{ items: Array<{ revision: number; diff: { changed: unknown[] } }> }>().items

    expect(items.map((r) => r.revision)).toEqual([1, 2])
    expect(items[1]?.diff.changed).toEqual([{ path: 'stage', before: 'lead', after: 'negotiation' }])
  })
})
