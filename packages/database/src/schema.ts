import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const observations = pgTable(
  'observations',
  {
    id: text('id').primaryKey(),
    pluginId: text('plugin_id').notNull(),
    sourceId: text('source_id').notNull(),
    type: text('type').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
    correlationId: text('correlation_id'),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('observations_plugin_id_idx').on(table.pluginId),
    index('observations_timestamp_idx').on(table.timestamp),
  ],
)

export type ObservationRow = typeof observations.$inferSelect
export type NewObservationRow = typeof observations.$inferInsert

export const memories = pgTable(
  'memories',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    content: jsonb('content').notNull(),
    sourceEventIds: jsonb('source_event_ids').notNull(),
    confidence: doublePrecision('confidence'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    revision: integer('revision').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('memories_type_idx').on(table.type),
    index('memories_updated_at_idx').on(table.updatedAt),
  ],
)

export type MemoryRow = typeof memories.$inferSelect
export type NewMemoryRow = typeof memories.$inferInsert

export const memoryRevisions = pgTable(
  'memory_revisions',
  {
    id: text('id').primaryKey(),
    memoryId: text('memory_id')
      .notNull()
      .references(() => memories.id),
    revision: integer('revision').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    sourceEventIds: jsonb('source_event_ids').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    diff: jsonb('diff').notNull(),
    reason: text('reason'),
  },
  (table) => [
    index('memory_revisions_memory_id_idx').on(table.memoryId),
    uniqueIndex('memory_revisions_memory_revision_uidx').on(table.memoryId, table.revision),
  ],
)

export type MemoryRevisionRow = typeof memoryRevisions.$inferSelect
export type NewMemoryRevisionRow = typeof memoryRevisions.$inferInsert
