import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { Observation, ObservationPage, ObservationQueryNormalized, ObservationStore } from '@fde-ai/domain'
import type { PgSchemaDatabase } from './client.js'
import { observations } from './schema.js'
import type { NewObservationRow, ObservationRow } from './schema.js'

/** Drizzle/PostgreSQL implementation of the Observation persistence boundary. */
export class DrizzleObservationStore implements ObservationStore {
  constructor(private readonly db: PgSchemaDatabase) {}

  async insert(observation: Observation): Promise<void> {
    await this.db.insert(observations).values(toRow(observation))
  }

  async get(id: string): Promise<Observation | undefined> {
    const rows = await this.db.select().from(observations).where(eq(observations.id, id)).limit(1)
    const row = rows[0]
    return row ? fromRow(row) : undefined
  }

  async list(query: ObservationQueryNormalized): Promise<ObservationPage> {
    const { limit } = query
    const offset = Number(query.cursor ?? '0')
    const conditions = [
      query.pluginId ? eq(observations.pluginId, query.pluginId) : undefined,
      query.sourceId ? eq(observations.sourceId, query.sourceId) : undefined,
      query.type ? eq(observations.type, query.type) : undefined,
      query.from ? gte(observations.timestamp, new Date(query.from)) : undefined,
      query.to ? lte(observations.timestamp, new Date(query.to)) : undefined,
    ].filter((condition) => condition !== undefined)

    const rows = await this.db
      .select()
      .from(observations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(observations.timestamp))
      .limit(limit + 1)
      .offset(offset)

    const items = rows.slice(0, limit).map(fromRow)
    const nextCursor = rows.length > limit ? String(offset + limit) : undefined
    return { items, nextCursor }
  }
}

function toRow(observation: Observation): NewObservationRow {
  return {
    id: observation.id,
    pluginId: observation.pluginId,
    sourceId: observation.sourceId,
    type: observation.type,
    timestamp: new Date(observation.timestamp),
    payload: observation.payload,
    correlationId: observation.correlationId,
    metadata: observation.metadata,
  }
}

function fromRow(row: ObservationRow): Observation {
  return {
    id: row.id,
    pluginId: row.pluginId,
    sourceId: row.sourceId,
    type: row.type,
    timestamp: row.timestamp.toISOString(),
    payload: row.payload,
    correlationId: row.correlationId ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  }
}
