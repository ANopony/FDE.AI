import {
  DrizzleMemoryStore,
  DrizzleObservationStore,
  InMemoryMemoryStore,
  InMemoryObservationStore,
  createDb,
  ensureSchema,
} from '@fde-ai/database'
import type { ConfigService, Logger, MemoryStore, ObservationStore } from '@fde-ai/domain'

export interface RuntimeStores {
  observationStore: ObservationStore
  memoryStore: MemoryStore
}

/**
 * Creates the runtime stores. Config key `store.driver` selects the backend:
 * - `postgres` (default): Drizzle/PostgreSQL from config key `database.url`,
 *   one shared connection pool, Phase 1 schema ensured once.
 * - `memory`: in-process stores, useful for local demos and E2E without Docker
 *   (data is lost on restart and must not be used in production).
 */
export async function createStores(config: ConfigService, logger: Logger): Promise<RuntimeStores> {
  const driver = (config.get<string>('store.driver') ?? 'postgres').toLowerCase()
  if (driver === 'memory') {
    logger.warn({ driver }, 'using in-memory stores; data is not persisted')
    return { observationStore: new InMemoryObservationStore(), memoryStore: new InMemoryMemoryStore() }
  }
  if (driver !== 'postgres') {
    throw new Error(`unsupported store.driver: ${driver} (expected "postgres" or "memory")`)
  }

  const url = config.getRequired<string>('database.url')
  const db = createDb(url)
  await ensureSchema(db)
  logger.info({}, 'runtime stores ready (postgres)')
  return {
    observationStore: new DrizzleObservationStore(db),
    memoryStore: new DrizzleMemoryStore(db),
  }
}
