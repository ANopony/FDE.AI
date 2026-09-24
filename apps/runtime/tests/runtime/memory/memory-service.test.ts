import { MemoryNotFoundError } from '@fde-ai/domain'
import type {
  EventBus,
  Logger,
  Memory,
  MemoryPage,
  MemoryQueryNormalized,
  MemoryRevision,
  MemoryRevisionQueryNormalized,
  MemoryStore,
  RuntimeEvent,
  TimelineMemoryChangePage,
} from '@fde-ai/domain'
import { describe, expect, it } from 'vitest'
import { DefaultMemoryService } from '../../../src/index.js'

const logger: Logger = { debug() {}, info() {}, warn() {}, error() {} }

interface StoredMemory {
  memory: Memory
  deletedAt?: string
}

class FakeMemoryStore implements MemoryStore {
  readonly memories = new Map<string, StoredMemory>()
  readonly revisions = new Map<string, MemoryRevision[]>()
  lastQuery: MemoryQueryNormalized | undefined

  async createWithRevision(memory: Memory, revision: MemoryRevision): Promise<void> {
    this.memories.set(memory.id, { memory })
    this.pushRevision(revision)
  }

  async updateWithRevision(memory: Memory, revision: MemoryRevision): Promise<void> {
    this.memories.set(memory.id, { memory })
    this.pushRevision(revision)
  }

  async deleteWithRevision(id: string, deletedAt: string, revision: MemoryRevision): Promise<void> {
    const stored = this.memories.get(id)
    if (stored) this.memories.set(id, { ...stored, deletedAt })
    this.pushRevision(revision)
  }

  async get(id: string): Promise<Memory | undefined> {
    const stored = this.memories.get(id)
    return stored && !stored.deletedAt ? stored.memory : undefined
  }

  async list(query: MemoryQueryNormalized): Promise<MemoryPage> {
    this.lastQuery = query
    const items = [...this.memories.values()]
      .filter((s) => !s.deletedAt)
      .map((s) => s.memory)
      .slice(0, query.limit)
    return { items }
  }

  async listRevisions(memoryId: string): Promise<MemoryRevision[]> {
    return this.revisions.get(memoryId) ?? []
  }

  async listRevisionsFiltered(_query: MemoryRevisionQueryNormalized): Promise<TimelineMemoryChangePage> {
    return { items: [] }
  }

  async exists(id: string): Promise<boolean> {
    return this.memories.has(id)
  }

  private pushRevision(revision: MemoryRevision): void {
    const list = this.revisions.get(revision.memoryId) ?? []
    list.push(revision)
    this.revisions.set(revision.memoryId, list)
  }
}

function makeService(store = new FakeMemoryStore(), events: RuntimeEvent[] = []) {
  const bus: EventBus = {
    publish: async (event) => void events.push(event),
    subscribe: () => () => {},
  }
  let n = 0
  const service = new DefaultMemoryService({
    store,
    bus,
    logger,
    idFactory: (prefix) => `${prefix}_${(n += 1)}`,
    now: () => '2026-01-01T00:00:00.000Z',
  })
  return { store, events, service }
}

const SOURCE = { sourceEventIds: ['obs_1', 'evt_1'] }

describe('DefaultMemoryService', () => {
  it('create stores the memory with revision 1 (before=null) and publishes memory.created', async () => {
    const { store, events, service } = makeService()

    const memory = await service.create({
      type: 'opportunity',
      content: { stage: 'lead' },
      ...SOURCE,
      reason: 'initial observation',
    })

    expect(memory.id).toBe('mem_1')
    expect(memory.revision).toBe(1)
    expect(await service.get('mem_1')).toEqual(memory)

    const revisions = await service.revisions('mem_1')
    expect(revisions).toHaveLength(1)
    expect(revisions[0]).toMatchObject({
      revision: 1,
      before: null,
      after: { stage: 'lead' },
      sourceEventIds: ['obs_1', 'evt_1'],
      reason: 'initial observation',
    })

    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('memory.created')
    expect((events[0]?.payload as { memory: Memory }).memory.id).toBe('mem_1')
    expect(store.lastQuery).toBeUndefined()
  })

  it('create rejects a memory without source events', async () => {
    const { service } = makeService()
    await expect(
      service.create({ type: 'opportunity', content: {}, sourceEventIds: [] }),
    ).rejects.toThrow()
  })

  it('update bumps the revision, diffs content, merges evidence and publishes memory.updated', async () => {
    const { store, events, service } = makeService()
    await service.create({ type: 'opportunity', content: { stage: 'lead' }, ...SOURCE })

    const updated = await service.update('mem_1', {
      content: { stage: 'negotiation' },
      sourceEventIds: ['obs_2'],
      reason: 'stage changed',
    })

    expect(updated.revision).toBe(2)
    expect(updated.sourceEventIds).toEqual(['obs_1', 'evt_1', 'obs_2'])
    expect(updated.confidence).toBeUndefined()

    const revisions = await service.revisions('mem_1')
    expect(revisions).toHaveLength(2)
    expect(revisions[1]).toMatchObject({
      revision: 2,
      before: { stage: 'lead' },
      after: { stage: 'negotiation' },
      diff: { changed: [{ path: 'stage', before: 'lead', after: 'negotiation' }], added: [], removed: [] },
      sourceEventIds: ['obs_2'],
      reason: 'stage changed',
    })

    expect(events.map((e) => e.type)).toEqual(['memory.created', 'memory.updated'])
    expect(store.memories.get('mem_1')?.memory.revision).toBe(2)
  })

  it('update with no changes is rejected', async () => {
    const { service } = makeService()
    await service.create({ type: 'opportunity', content: {}, ...SOURCE })
    await expect(service.update('mem_1', {})).rejects.toThrow(/at least one/)
  })

  it('update of an unknown memory throws MemoryNotFoundError', async () => {
    const { service } = makeService()
    await expect(service.update('missing', { content: {} })).rejects.toThrow(MemoryNotFoundError)
  })

  it('delete produces a revision with after=null and hides the memory but keeps the audit trail', async () => {
    const { events, service } = makeService()
    await service.create({ type: 'opportunity', content: { stage: 'lead' }, ...SOURCE })

    const deletion = await service.delete('mem_1', 'opportunity lost')

    expect(deletion.revision).toBe(2)
    expect(deletion.after).toBeNull()
    expect(deletion.before).toEqual({ stage: 'lead' })
    expect(deletion.sourceEventIds).toEqual([])

    await expect(service.get('mem_1')).rejects.toThrow(MemoryNotFoundError)
    expect(await service.revisions('mem_1')).toHaveLength(2)
    expect(events.map((e) => e.type)).toEqual(['memory.created', 'memory.deleted'])
  })

  it('list normalizes the query with a default limit', async () => {
    const { store, service } = makeService()
    await service.create({ type: 'customer', content: {}, ...SOURCE })

    await service.list({})

    expect(store.lastQuery?.limit).toBe(50)
  })
})
