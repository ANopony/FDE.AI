import {
  EVENT_TYPES,
  MemoryCreateInputSchema,
  MemoryNotFoundError,
  MemoryQuerySchema,
  MemoryUpdateInputSchema,
  computeDiff,
} from '@fde-ai/domain'
import type {
  EventBus,
  Logger,
  Memory,
  MemoryCreateInput,
  MemoryPage,
  MemoryQuery,
  MemoryRevision,
  MemoryService,
  MemoryStore,
  MemoryUpdateInput,
} from '@fde-ai/domain'

export interface MemoryServiceOptions {
  store: MemoryStore
  bus: EventBus
  logger: Logger
  idFactory?: (prefix: string) => string
  now?: () => string
}

/**
 * Every create/update/delete produces a MemoryRevision (before / after /
 * diff / reason / sourceEventIds) and publishes a memory.* runtime event.
 */
export class DefaultMemoryService implements MemoryService {
  private readonly idFactory: (prefix: string) => string
  private readonly now: () => string

  constructor(private readonly options: MemoryServiceOptions) {
    this.idFactory = options.idFactory ?? ((prefix) => `${prefix}_${crypto.randomUUID()}`)
    this.now = options.now ?? (() => new Date().toISOString())
  }

  async create(input: MemoryCreateInput): Promise<Memory> {
    const parsed = MemoryCreateInputSchema.parse(input)
    const now = this.now()
    const memory: Memory = {
      id: this.idFactory('mem'),
      type: parsed.type,
      content: parsed.content,
      sourceEventIds: parsed.sourceEventIds,
      confidence: parsed.confidence,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    }
    const revision: MemoryRevision = {
      id: this.idFactory('rev'),
      memoryId: memory.id,
      revision: 1,
      timestamp: now,
      sourceEventIds: parsed.sourceEventIds,
      before: null,
      after: parsed.content,
      diff: computeDiff(null, parsed.content),
      reason: parsed.reason,
    }
    await this.options.store.createWithRevision(memory, revision)
    await this.publish(EVENT_TYPES.memoryCreated, memory, revision)
    return memory
  }

  async get(id: string): Promise<Memory> {
    const memory = await this.options.store.get(id)
    if (!memory) {
      throw new MemoryNotFoundError(`Memory not found: ${id}`, id)
    }
    return memory
  }

  async list(query: MemoryQuery): Promise<MemoryPage> {
    return this.options.store.list(MemoryQuerySchema.parse(query))
  }

  async update(id: string, input: MemoryUpdateInput): Promise<Memory> {
    const parsed = MemoryUpdateInputSchema.parse(input)
    const current = await this.get(id)
    const now = this.now()
    const content = parsed.content !== undefined ? parsed.content : current.content
    const confidence = parsed.confidence !== undefined ? parsed.confidence : current.confidence
    const sourceEventIds = parsed.sourceEventIds
      ? [...new Set([...current.sourceEventIds, ...parsed.sourceEventIds])]
      : current.sourceEventIds
    const memory: Memory = {
      ...current,
      content,
      confidence,
      sourceEventIds,
      updatedAt: now,
      revision: current.revision + 1,
    }
    const revision: MemoryRevision = {
      id: this.idFactory('rev'),
      memoryId: id,
      revision: memory.revision,
      timestamp: now,
      sourceEventIds: parsed.sourceEventIds ?? [],
      before: current.content,
      after: content,
      diff: computeDiff(current.content, content),
      reason: parsed.reason,
    }
    await this.options.store.updateWithRevision(memory, revision)
    await this.publish(EVENT_TYPES.memoryUpdated, memory, revision)
    return memory
  }

  async delete(id: string, reason?: string): Promise<MemoryRevision> {
    const current = await this.get(id)
    const now = this.now()
    const revision: MemoryRevision = {
      id: this.idFactory('rev'),
      memoryId: id,
      revision: current.revision + 1,
      timestamp: now,
      sourceEventIds: [],
      before: current.content,
      after: null,
      diff: computeDiff(current.content, null),
      reason,
    }
    await this.options.store.deleteWithRevision(id, now, revision)
    await this.publish(EVENT_TYPES.memoryDeleted, current, revision)
    return revision
  }

  async revisions(id: string): Promise<MemoryRevision[]> {
    const exists = await this.options.store.exists(id)
    if (!exists) {
      throw new MemoryNotFoundError(`Memory not found: ${id}`, id)
    }
    return this.options.store.listRevisions(id)
  }

  private async publish(type: string, memory: Memory, revision: MemoryRevision): Promise<void> {
    await this.options.bus.publish({
      id: this.idFactory('evt'),
      type,
      timestamp: revision.timestamp,
      source: memory.id,
      payload: { memory, revision },
    })
  }
}
