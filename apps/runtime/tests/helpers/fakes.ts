import type {
  Memory,
  MemoryPage,
  MemoryQueryNormalized,
  MemoryRevision,
  MemoryRevisionQueryNormalized,
  MemoryStore,
  Observation,
  ObservationPage,
  ObservationQueryNormalized,
  ObservationStore,
  TimelineMemoryChange,
  TimelineMemoryChangePage,
} from '@fde-ai/domain'

/** In-memory ObservationStore used across runtime tests. */
export class FakeObservationStore implements ObservationStore {
  readonly items = new Map<string, Observation>()

  async insert(observation: Observation): Promise<void> {
    this.items.set(observation.id, observation)
  }

  async get(id: string): Promise<Observation | undefined> {
    return this.items.get(id)
  }

  async list(query: ObservationQueryNormalized): Promise<ObservationPage> {
    const { limit } = query
    const offset = Number(query.cursor ?? '0')
    const filtered = [...this.items.values()]
      .filter(
        (o) =>
          (!query.pluginId || o.pluginId === query.pluginId) &&
          (!query.sourceId || o.sourceId === query.sourceId) &&
          (!query.from || o.timestamp >= query.from) &&
          (!query.to || o.timestamp <= query.to),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const items = filtered.slice(offset, offset + limit)
    const nextCursor = offset + limit < filtered.length ? String(offset + limit) : undefined
    return { items, nextCursor }
  }
}

/** In-memory MemoryStore used across runtime tests. */
export class FakeMemoryStore implements MemoryStore {
  readonly memories = new Map<string, Memory>()
  readonly deleted = new Set<string>()
  private readonly revisionLog: TimelineMemoryChange[] = []
  private readonly revisionsByMemory = new Map<string, MemoryRevision[]>()

  async createWithRevision(memory: Memory, revision: MemoryRevision): Promise<void> {
    this.memories.set(memory.id, memory)
    this.log(memory, revision)
  }

  async updateWithRevision(memory: Memory, revision: MemoryRevision): Promise<void> {
    this.memories.set(memory.id, memory)
    this.log(memory, revision)
  }

  async deleteWithRevision(id: string, _deletedAt: string, revision: MemoryRevision): Promise<void> {
    this.deleted.add(id)
    this.log(this.memories.get(id), revision)
  }

  async get(id: string): Promise<Memory | undefined> {
    return this.memories.has(id) && !this.deleted.has(id) ? this.memories.get(id) : undefined
  }

  async list(query: MemoryQueryNormalized): Promise<MemoryPage> {
    const filtered = [...this.memories.values()].filter(
      (m) => !this.deleted.has(m.id) && (!query.type || m.type === query.type),
    )
    return { items: filtered.slice(0, query.limit) }
  }

  async listRevisions(memoryId: string): Promise<MemoryRevision[]> {
    return this.revisionsByMemory.get(memoryId) ?? []
  }

  async listRevisionsFiltered(query: MemoryRevisionQueryNormalized): Promise<TimelineMemoryChangePage> {
    const { limit } = query
    const offset = Number(query.cursor ?? '0')
    const filtered = this.revisionLog
      .filter(
        (c) =>
          (!query.memoryId || c.revision.memoryId === query.memoryId) &&
          (!query.from || c.revision.timestamp >= query.from) &&
          (!query.to || c.revision.timestamp <= query.to),
      )
      .sort((a, b) => b.revision.timestamp.localeCompare(a.revision.timestamp))
    const items = filtered.slice(offset, offset + limit)
    const nextCursor = offset + limit < filtered.length ? String(offset + limit) : undefined
    return { items, nextCursor }
  }

  async exists(id: string): Promise<boolean> {
    return this.memories.has(id)
  }

  private log(memory: Memory | undefined, revision: MemoryRevision): void {
    this.revisionLog.push({ revision, memoryType: memory?.type ?? 'unknown' })
    const list = this.revisionsByMemory.get(revision.memoryId) ?? []
    list.push(revision)
    this.revisionsByMemory.set(revision.memoryId, list)
  }
}
