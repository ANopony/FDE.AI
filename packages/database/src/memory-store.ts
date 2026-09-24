import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import type {
  Memory,
  MemoryPage,
  MemoryQueryNormalized,
  MemoryRevision,
  MemoryRevisionQueryNormalized,
  MemoryStore,
  TimelineMemoryChangePage,
} from '@fde-ai/domain'
import type { PgSchemaDatabase } from './client.js'
import { memories, memoryRevisions } from './schema.js'
import type { MemoryRevisionRow, MemoryRow, NewMemoryRevisionRow, NewMemoryRow } from './schema.js'

/** Drizzle/PostgreSQL implementation of the Memory persistence boundary. */
export class DrizzleMemoryStore implements MemoryStore {
  constructor(private readonly db: PgSchemaDatabase) {}

  async createWithRevision(memory: Memory, revision: MemoryRevision): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(memories).values(toMemoryRow(memory))
      await tx.insert(memoryRevisions).values(toRevisionRow(revision))
    })
  }

  async updateWithRevision(memory: Memory, revision: MemoryRevision): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(memories)
        .set({
          content: memory.content,
          confidence: memory.confidence,
          sourceEventIds: memory.sourceEventIds,
          updatedAt: new Date(memory.updatedAt),
          revision: memory.revision,
        })
        .where(eq(memories.id, memory.id))
      await tx.insert(memoryRevisions).values(toRevisionRow(revision))
    })
  }

  async deleteWithRevision(id: string, deletedAt: string, revision: MemoryRevision): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(memories).set({ deletedAt: new Date(deletedAt) }).where(eq(memories.id, id))
      await tx.insert(memoryRevisions).values(toRevisionRow(revision))
    })
  }

  async get(id: string): Promise<Memory | undefined> {
    const rows = await this.db
      .select()
      .from(memories)
      .where(and(eq(memories.id, id), isNull(memories.deletedAt)))
      .limit(1)
    const row = rows[0]
    return row ? fromMemoryRow(row) : undefined
  }

  async list(query: MemoryQueryNormalized): Promise<MemoryPage> {
    const { limit } = query
    const offset = Number(query.cursor ?? '0')
    const conditions = [
      query.type ? eq(memories.type, query.type) : undefined,
      query.updatedFrom ? gte(memories.updatedAt, new Date(query.updatedFrom)) : undefined,
      query.updatedTo ? lte(memories.updatedAt, new Date(query.updatedTo)) : undefined,
    ].filter((condition) => condition !== undefined)

    const rows = await this.db
      .select()
      .from(memories)
      .where(and(isNull(memories.deletedAt), ...conditions))
      .orderBy(desc(memories.updatedAt))
      .limit(limit + 1)
      .offset(offset)

    const items = rows.slice(0, limit).map(fromMemoryRow)
    const nextCursor = rows.length > limit ? String(offset + limit) : undefined
    return { items, nextCursor }
  }

  async listRevisions(memoryId: string): Promise<MemoryRevision[]> {
    const rows = await this.db
      .select()
      .from(memoryRevisions)
      .where(eq(memoryRevisions.memoryId, memoryId))
      .orderBy(asc(memoryRevisions.revision))
    return rows.map(fromRevisionRow)
  }

  async listRevisionsFiltered(query: MemoryRevisionQueryNormalized): Promise<TimelineMemoryChangePage> {
    const { limit } = query
    const offset = Number(query.cursor ?? '0')
    const conditions = [
      query.memoryId ? eq(memoryRevisions.memoryId, query.memoryId) : undefined,
      query.from ? gte(memoryRevisions.timestamp, new Date(query.from)) : undefined,
      query.to ? lte(memoryRevisions.timestamp, new Date(query.to)) : undefined,
    ].filter((condition) => condition !== undefined)

    const rows = await this.db
      .select({ revision: memoryRevisions, memoryType: memories.type })
      .from(memoryRevisions)
      .innerJoin(memories, eq(memoryRevisions.memoryId, memories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(memoryRevisions.timestamp))
      .limit(limit + 1)
      .offset(offset)

    const items = rows.slice(0, limit).map((row) => ({
      revision: fromRevisionRow(row.revision),
      memoryType: row.memoryType,
    }))
    const nextCursor = rows.length > limit ? String(offset + limit) : undefined
    return { items, nextCursor }
  }

  async exists(id: string): Promise<boolean> {
    const rows = await this.db.select({ id: memories.id }).from(memories).where(eq(memories.id, id)).limit(1)
    return rows.length > 0
  }
}

function toMemoryRow(memory: Memory): NewMemoryRow {
  return {
    id: memory.id,
    type: memory.type,
    content: memory.content,
    sourceEventIds: memory.sourceEventIds,
    confidence: memory.confidence ?? null,
    createdAt: new Date(memory.createdAt),
    updatedAt: new Date(memory.updatedAt),
    revision: memory.revision,
  }
}

function fromMemoryRow(row: MemoryRow): Memory {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    sourceEventIds: row.sourceEventIds as string[],
    confidence: row.confidence ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revision: row.revision,
  }
}

function toRevisionRow(revision: MemoryRevision): NewMemoryRevisionRow {
  return {
    id: revision.id,
    memoryId: revision.memoryId,
    revision: revision.revision,
    timestamp: new Date(revision.timestamp),
    sourceEventIds: revision.sourceEventIds,
    before: revision.before ?? null,
    after: revision.after ?? null,
    diff: revision.diff,
    reason: revision.reason ?? null,
  }
}

function fromRevisionRow(row: MemoryRevisionRow): MemoryRevision {
  return {
    id: row.id,
    memoryId: row.memoryId,
    revision: row.revision,
    timestamp: row.timestamp.toISOString(),
    sourceEventIds: row.sourceEventIds as string[],
    before: row.before,
    after: row.after,
    diff: row.diff,
    reason: row.reason ?? undefined,
  }
}
