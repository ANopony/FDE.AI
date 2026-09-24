import type { Logger, Memory, MemoryRevision } from '@fde-ai/domain'
import { describe, expect, it } from 'vitest'
import { DefaultTimelineService } from '../../../src/index.js'
import { FakeMemoryStore, FakeObservationStore } from '../../helpers/fakes.js'

const logger: Logger = { debug() {}, info() {}, warn() {}, error() {} }

function makeMemory(id: string, content: unknown, overrides: Partial<Memory> = {}): Memory {
  return {
    id,
    type: 'opportunity',
    content,
    sourceEventIds: ['obs_1'],
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    revision: 1,
    ...overrides,
  }
}

function makeRevision(id: string, memoryId: string, revision: number, timestamp: string, after: unknown): MemoryRevision {
  return {
    id,
    memoryId,
    revision,
    timestamp,
    sourceEventIds: ['obs_1'],
    before: null,
    after,
    diff: { changed: [], added: [], removed: [] },
    reason: 'seeded',
  }
}

function makeService() {
  const observationStore = new FakeObservationStore()
  const memoryStore = new FakeMemoryStore()
  const service = new DefaultTimelineService({ observationStore, memoryStore, logger })
  return { observationStore, memoryStore, service }
}

async function seed() {
  const { observationStore, memoryStore, service } = makeService()
  await observationStore.insert({
    id: 'obs_1',
    pluginId: 'test-observer',
    sourceId: 'test.source',
    type: 'test.observation',
    timestamp: '2026-01-01T10:00:00.000Z',
    payload: { n: 1 },
  })
  await observationStore.insert({
    id: 'obs_2',
    pluginId: 'test-observer',
    sourceId: 'test.source',
    type: 'test.observation',
    timestamp: '2026-01-01T12:00:00.000Z',
    payload: { n: 2 },
  })
  await memoryStore.createWithRevision(
    makeMemory('mem_1', { stage: 'lead' }),
    makeRevision('rev_1', 'mem_1', 1, '2026-01-01T11:00:00.000Z', { stage: 'lead' }),
  )
  return { observationStore, memoryStore, service }
}

describe('DefaultTimelineService', () => {
  it('merges observations and memory changes into one newest-first timeline', async () => {
    const { service } = await seed()

    const page = await service.query({})

    expect(page.items.map((i) => i.id)).toEqual(['obs_2', 'rev_1', 'obs_1'])
    expect(page.items.map((i) => i.kind)).toEqual(['observation', 'memory_change', 'observation'])
    expect(page.items[1]).toMatchObject({
      title: 'opportunity memory created',
      source: 'mem_1',
      relatedIds: ['mem_1', 'obs_1'],
      detailRef: '/api/memories/mem_1/revisions',
    })
    expect(page.items[2]).toMatchObject({
      pluginId: 'test-observer',
      source: 'test.source',
      detailRef: '/api/observations/obs_1',
    })
  })

  it('filters by kind', async () => {
    const { service } = await seed()

    const observations = await service.query({ kind: 'observation' })
    expect(observations.items.map((i) => i.id)).toEqual(['obs_2', 'obs_1'])

    const memoryChanges = await service.query({ kind: 'memory_change' })
    expect(memoryChanges.items.map((i) => i.id)).toEqual(['rev_1'])
  })

  it('filters by memoryId and sourceId', async () => {
    const { service } = await seed()

    const byMemory = await service.query({ memoryId: 'mem_1' })
    expect(byMemory.items.map((i) => i.id)).toEqual(['rev_1'])

    const bySource = await service.query({ sourceId: 'test.source' })
    expect(bySource.items.map((i) => i.id)).toEqual(['obs_2', 'obs_1'])
  })

  it('excludes memory changes when filtering by plugin', async () => {
    const { service } = await seed()

    const byPlugin = await service.query({ pluginId: 'test-observer' })
    expect(byPlugin.items.map((i) => i.id)).toEqual(['obs_2', 'obs_1'])

    const byOtherPlugin = await service.query({ pluginId: 'unknown-plugin' })
    expect(byOtherPlugin.items).toEqual([])
  })

  it('filters by time range', async () => {
    const { service } = await seed()

    const page = await service.query({ from: '2026-01-01T11:00:00.000Z' })
    expect(page.items.map((i) => i.id)).toEqual(['obs_2', 'rev_1'])
  })

  it('paginates across both sources without skipping items', async () => {
    const { service } = await seed()

    const first = await service.query({ limit: 2 })
    expect(first.items.map((i) => i.id)).toEqual(['obs_2', 'rev_1'])
    expect(first.nextCursor).toBe('o=1;r=1')

    const second = await service.query({ limit: 2, cursor: first.nextCursor })
    expect(second.items.map((i) => i.id)).toEqual(['obs_1'])
    expect(second.nextCursor).toBeUndefined()
  })

  it('orders same-timestamp items effect-first and tolerates cursor boundaries', async () => {
    const { observationStore, memoryStore, service } = makeService()
    await observationStore.insert({
      id: 'obs_same',
      pluginId: 'test-observer',
      sourceId: 'test.source',
      type: 'test.observation',
      timestamp: '2026-01-01T09:00:00.000Z',
      payload: {},
    })
    await memoryStore.createWithRevision(
      makeMemory('mem_same', { stage: 'lead' }),
      makeRevision('rev_same', 'mem_same', 1, '2026-01-01T09:00:00.000Z', { stage: 'lead' }),
    )

    const page = await service.query({})
    expect(page.items.map((i) => i.kind)).toEqual(['memory_change', 'observation'])

    // cursor past the end yields an empty page instead of an error or a loop
    const empty = await service.query({ limit: 5, cursor: 'o=99;r=99' })
    expect(empty.items).toEqual([])
    expect(empty.nextCursor).toBeUndefined()
  })

  it('rejects invalid input', async () => {
    const { service } = await seed()
    await expect(service.query({ kind: 'bogus' as never })).rejects.toThrow()
  })
})
