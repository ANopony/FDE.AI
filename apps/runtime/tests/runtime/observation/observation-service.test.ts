import { ObservationNotFoundError } from '@fde-ai/domain'
import type { EventBus, Logger, Observation, ObservationStore, RuntimeEvent } from '@fde-ai/domain'
import { describe, expect, it } from 'vitest'
import { DefaultObservationService } from '../../../src/index.js'

const logger: Logger = { debug() {}, info() {}, warn() {}, error() {} }

class FakeStore implements ObservationStore {
  readonly items = new Map<string, Observation>()
  lastQuery: Record<string, unknown> | undefined

  async insert(observation: Observation): Promise<void> {
    this.items.set(observation.id, observation)
  }

  async get(id: string): Promise<Observation | undefined> {
    return this.items.get(id)
  }

  async list(query: Record<string, unknown>): Promise<{ items: Observation[] }> {
    this.lastQuery = query
    return { items: [...this.items.values()] }
  }
}

describe('DefaultObservationService', () => {
  it('emit persists, publishes observation.created and keeps ids consistent', async () => {
    const store = new FakeStore()
    const events: RuntimeEvent[] = []
    const bus: EventBus = { publish: async (e) => void events.push(e), subscribe: () => () => {} }
    let n = 0
    const service = new DefaultObservationService({
      store,
      bus,
      logger,
      idFactory: (prefix) => `${prefix}_${(n += 1)}`,
      now: () => '2026-01-01T00:00:00.000Z',
    })

    const observation = await service.emit({
      pluginId: 'test-observer',
      sourceId: 'test.source',
      type: 'test.observation',
      payload: { hello: 'world' },
    })

    expect(observation.id).toBe('obs_1')
    expect(observation.timestamp).toBe('2026-01-01T00:00:00.000Z')
    expect(store.items.get('obs_1')).toEqual(observation)

    expect(events).toHaveLength(1)
    const event = events[0]
    expect(event?.type).toBe('observation.created')
    expect(event?.payload).toEqual(observation)
    expect(event?.correlationId).toBe(observation.correlationId)
    expect(event?.correlationId).toMatch(/^trace_/)
    expect(event?.source).toBe('test.source')
    expect(event?.timestamp).toBe(observation.timestamp)
  })

  it('reuses a provided correlationId and timestamp', async () => {
    const store = new FakeStore()
    const bus: EventBus = { publish: async () => {}, subscribe: () => () => {} }
    const service = new DefaultObservationService({ store, bus, logger })

    const observation = await service.emit({
      pluginId: 'test-observer',
      sourceId: 'test.source',
      type: 'test.observation',
      timestamp: '2026-02-02T02:02:02.000Z',
      correlationId: 'trace_custom',
      payload: {},
    })

    expect(observation.correlationId).toBe('trace_custom')
    expect(observation.timestamp).toBe('2026-02-02T02:02:02.000Z')
  })

  it('emit rejects invalid input', async () => {
    const service = new DefaultObservationService({
      store: new FakeStore(),
      bus: { publish: async () => {}, subscribe: () => () => {} },
      logger,
    })
    await expect(
      service.emit({ pluginId: '', sourceId: 's', type: 't', payload: {} }),
    ).rejects.toThrow()
  })

  it('get returns the stored observation and throws for missing ids', async () => {
    const store = new FakeStore()
    const service = new DefaultObservationService({
      store,
      bus: { publish: async () => {}, subscribe: () => () => {} },
      logger,
    })
    const observation = await service.emit({
      pluginId: 'test-observer',
      sourceId: 'test.source',
      type: 'test.observation',
      payload: {},
    })

    await expect(service.get(observation.id)).resolves.toEqual(observation)
    await expect(service.get('missing')).rejects.toThrow(ObservationNotFoundError)
  })

  it('list normalizes the query (default limit) and delegates to the store', async () => {
    const store = new FakeStore()
    const service = new DefaultObservationService({
      store,
      bus: { publish: async () => {}, subscribe: () => () => {} },
      logger,
    })

    await service.list({})

    expect(store.lastQuery?.limit).toBe(50)
  })
})
