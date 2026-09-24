import { sql } from 'drizzle-orm'
import type { PgSchemaDatabase } from '../src/client.js'
import { ensureSchema } from '../src/index.js'

/**
 * Schema setup for DB-backed suites. Test files run in parallel against one
 * database, so cleanup is scoped to each file's own id prefix instead of
 * truncating tables another file may be using.
 */
export async function ensureTestSchema(db: PgSchemaDatabase): Promise<void> {
  await ensureSchema(db)
}

export async function deleteTestObservations(db: PgSchemaDatabase, prefix = 'db_test_'): Promise<void> {
  await db.execute(sql`DELETE FROM observations WHERE id LIKE ${`${prefix}%`}`)
}

export async function deleteTestMemories(db: PgSchemaDatabase, prefix = 'mem_db_'): Promise<void> {
  await db.execute(sql`DELETE FROM memory_revisions WHERE memory_id LIKE ${`${prefix}%`}`)
  await db.execute(sql`DELETE FROM memories WHERE id LIKE ${`${prefix}%`}`)
}
