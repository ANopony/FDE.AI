import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'
import * as schema from './schema.js'

/** Driver used by the runtime (node-postgres). */
export type Database = NodePgDatabase<typeof schema>

/**
 * Any Drizzle PostgreSQL database over our schema. Stores accept this so the
 * same SQL layer can be exercised by other drivers (e.g. PGlite in tests).
 */
export type PgSchemaDatabase<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> = PgDatabase<
  TQueryResult,
  typeof schema
>

export function createDb(connectionString: string): Database {
  const pool = new Pool({ connectionString })
  return drizzle(pool, { schema })
}

/** Closes the connection pool behind a database created by `createDb`. */
export async function closeDb(db: Database): Promise<void> {
  const client = (db as unknown as { $client?: { end: () => Promise<void> } }).$client
  await client?.end()
}

/**
 * Phase 1 schema bootstrap. Statements are executed one by one because
 * PostgreSQL's extended query protocol (used by both node-postgres prepared
 * statements and PGlite) rejects multiple commands in a single statement.
 * Formal migrations (drizzle-kit) remain a follow-up hardening item.
 */
export const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS observations (
    id text PRIMARY KEY,
    plugin_id text NOT NULL,
    source_id text NOT NULL,
    type text NOT NULL,
    timestamp timestamptz NOT NULL,
    payload jsonb NOT NULL,
    correlation_id text,
    metadata jsonb
  )`,
  `CREATE INDEX IF NOT EXISTS observations_plugin_id_idx ON observations (plugin_id)`,
  `CREATE INDEX IF NOT EXISTS observations_timestamp_idx ON observations (timestamp)`,
  `CREATE TABLE IF NOT EXISTS memories (
    id text PRIMARY KEY,
    type text NOT NULL,
    content jsonb NOT NULL,
    source_event_ids jsonb NOT NULL,
    confidence double precision,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    revision integer NOT NULL,
    deleted_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS memories_type_idx ON memories (type)`,
  `CREATE INDEX IF NOT EXISTS memories_updated_at_idx ON memories (updated_at)`,
  `CREATE TABLE IF NOT EXISTS memory_revisions (
    id text PRIMARY KEY,
    memory_id text NOT NULL REFERENCES memories (id),
    revision integer NOT NULL,
    timestamp timestamptz NOT NULL,
    source_event_ids jsonb NOT NULL,
    before jsonb,
    after jsonb,
    diff jsonb NOT NULL,
    reason text
  )`,
  `CREATE INDEX IF NOT EXISTS memory_revisions_memory_id_idx ON memory_revisions (memory_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS memory_revisions_memory_revision_uidx ON memory_revisions (memory_id, revision)`,
]

/**
 * Creates the Phase 1 tables. `CREATE TABLE IF NOT EXISTS` is not safe against
 * concurrent creators on PostgreSQL (two sessions can race on pg_type), so the
 * statements run inside one transaction guarded by an advisory lock: parallel
 * runtime instances or parallel test files can bootstrap the schema safely.
 */
export async function ensureSchema(db: PgSchemaDatabase): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(`SELECT pg_advisory_xact_lock(hashtext('fde_ai_phase1_schema'))`)
    for (const statement of SCHEMA_STATEMENTS) {
      await tx.execute(statement)
    }
  })
}
