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

/**
 * In-memory ObservationStore for local demos, integration tests and the
 * E2E demo harness. Production runtime uses DrizzleObservationStore.
 */
export class InMemoryObservationStore implements ObservationStore {
  private readonly items = new Map<string, Observation>()

  async insert(observation: Observation): Promise<void> {
    if (this.items.has(observation.id)) {
      throw new Error(`duplicate observation id: ${observation.id}`)
    }
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
          (!query.type || o.type === query.type) &&
          (!query.from || o.timestamp >= query.from) &&
          (!query.to || o.timestamp <= query.to),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const items = filtered.slice(offset, offset + limit)
    const nextCursor = offset + limit < filtered.length ? String(offset + limit) : undefined
    return { items, nextCursor }
  }

  get size(): number {
    return this.items.size
  }
}

/** In-memory MemoryStore mirroring the Drizzle semantics (soft delete included). */
export class InMemoryMemoryStore implements MemoryStore {
  private readonly memories = new Map<string, Memory>()
  private readonly deleted = new Set<string>()
  private readonly revisionLog: TimelineMemoryChange[] = []
  private readonly revisionsByMemory = new Map<string, MemoryRevision[]>()

  async createWithRevision(memory: Memory, revision: MemoryRevision): Promise<void> {
    if (this.memories.has(memory.id)) {
      throw new Error(`duplicate memory id: ${memory.id}`)
    }
    this.memories.set(memory.id, memory)
    this.record(memory, revision)
  }

  async updateWithRevision(memory: Memory, revision: MemoryRevision): Promise<void> {
    const current = this.memories.get(memory.id)
    if (current && revision.revision !== current.revision + 1) {
      throw new Error(
        `stale revision for ${memory.id}: expected ${current.revision + 1}, got ${revision.revision}`,
      )
    }
    this.memories.set(memory.id, memory)
    this.record(memory, revision)
  }

  async deleteWithRevision(id: string, _deletedAt: string, revision: MemoryRevision): Promise<void> {
    this.deleted.add(id)
    this.record(this.memories.get(id), revision)
  }

  async get(id: string): Promise<Memory | undefined> {
    return this.deleted.has(id) ? undefined : this.memories.get(id)
  }

  async list(query: MemoryQueryNormalized): Promise<MemoryPage> {
    const { limit } = query
    const offset = Number(query.cursor ?? '0')
    const filtered = [...this.memories.values()]
      .filter(
        (m) =>
          !this.deleted.has(m.id) &&
          (!query.type || m.type === query.type) &&
          (!query.updatedFrom || m.updatedAt >= query.updatedFrom) &&
          (!query.updatedTo || m.updatedAt <= query.updatedTo),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const items = filtered.slice(offset, offset + limit)
    const nextCursor = offset + limit < filtered.length ? String(offset + limit) : undefined
    return { items, nextCursor }
  }

  async listRevisions(memoryId: string): Promise<MemoryRevision[]> {
    return this.revisionsByMemory.get(memoryId) ?? []
  }

  async listRevisionsFiltered(query: MemoryRevisionQueryNormalized): Promise<TimelineMemoryChangePage> {
    const { limit } = query
    const offset = Number(query.cursor ?? '0')
    const filtered = this.revisionLog
      .filter(
        (change) =>
          (!query.memoryId || change.revision.memoryId === query.memoryId) &&
          (!query.from || change.revision.timestamp >= query.from) &&
          (!query.to || change.revision.timestamp <= query.to),
      )
      .sort((a, b) => b.revision.timestamp.localeCompare(a.revision.timestamp))
    const items = filtered.slice(offset, offset + limit)
    const nextCursor = offset + limit < filtered.length ? String(offset + limit) : undefined
    return { items, nextCursor }
  }

  async exists(id: string): Promise<boolean> {
    return this.memories.has(id)
  }

  private record(memory: Memory | undefined, revision: MemoryRevision): void {
    this.revisionLog.push({ revision, memoryType: memory?.type ?? 'unknown' })
    const list = this.revisionsByMemory.get(revision.memoryId) ?? []
    list.push(revision)
    this.revisionsByMemory.set(revision.memoryId, list)
  }
}
