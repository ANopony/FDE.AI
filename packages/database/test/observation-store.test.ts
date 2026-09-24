import type { Observation } from '@fde-ai/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../src/index.js'
import { DrizzleObservationStore, closeDb, createDb } from '../src/index.js'
import { deleteTestObservations, ensureTestSchema } from './helpers.js'

// Runs against a real PostgreSQL when TEST_DATABASE_URL is set, e.g.
// docker compose up -d db
// TEST_DATABASE_URL=postgres://fde:fde@localhost:5432/fde pnpm test
const maybe = describe.skipIf(!process.env.TEST_DATABASE_URL)

function makeObservation(id: string, overrides: Partial<Observation> = {}): Observation {
  return {
    id,
    pluginId: 'test-observer',
    sourceId: 'test.source',
    type: 'test.observation',
    timestamp: '2026-01-01T00:00:00.000Z',
    payload: { stage: 'lead' },
    ...overrides,
  }
}

maybe('DrizzleObservationStore (PostgreSQL)', () => {
  let db: Database
  let store: DrizzleObservationStore

  beforeAll(async () => {
    db = createDb(process.env.TEST_DATABASE_URL as string)
    await ensureTestSchema(db)
    await deleteTestObservations(db)
    store = new DrizzleObservationStore(db)
  })

  afterAll(async () => {
    await deleteTestObservations(db)
    await closeDb(db)
  })

  it('insert then get roundtrips jsonb payload and ISO timestamp', async () => {
    const observation = makeObservation('db_test_1', { payload: { stage: 'lead', amount: 42 } })

    await store.insert(observation)

    expect(await store.get('db_test_1')).toEqual(observation)
    expect(await store.get('db_test_missing')).toBeUndefined()
  })

  it('list filters by pluginId / sourceId / type / time range, newest first', async () => {
    await store.insert(makeObservation('db_test_2', { timestamp: '2026-01-01T10:00:00.000Z', type: 'a.type' }))
    await store.insert(makeObservation('db_test_3', { timestamp: '2026-01-01T12:00:00.000Z', type: 'b.type' }))

    const page = await store.list({
      pluginId: 'test-observer',
      from: '2026-01-01T09:00:00.000Z',
      limit: 10,
    })

    expect(page.items.map((o) => o.id)).toEqual(['db_test_3', 'db_test_2'])
    expect(page.nextCursor).toBeUndefined()

    const byType = await store.list({ type: 'b.type', limit: 10 })
    expect(byType.items.map((o) => o.id)).toEqual(['db_test_3'])
  })

  it('paginates with a cursor', async () => {
    for (let i = 4; i <= 8; i += 1) {
      await store.insert(makeObservation(`db_test_${i}`, { timestamp: `2026-01-02T0${i}:00:00.000Z` }))
    }

    const first = await store.list({ sourceId: 'test.source', from: '2026-01-02T00:00:00.000Z', limit: 3 })
    expect(first.items).toHaveLength(3)
    expect(first.nextCursor).toBe('3')

    const second = await store.list({
      sourceId: 'test.source',
      from: '2026-01-02T00:00:00.000Z',
      limit: 3,
      cursor: first.nextCursor,
    })
    expect(second.items).toHaveLength(2)
    expect(second.nextCursor).toBeUndefined()
  })
})
