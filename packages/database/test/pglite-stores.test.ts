import { PGlite } from '@electric-sql/pglite'
import type { Memory, Observation } from '@fde-ai/domain'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { DrizzleMemoryStore, DrizzleObservationStore, ensureSchema } from '../src/index.js'
import type { PgSchemaDatabase } from '../src/client.js'
import { memories, memoryRevisions, observations } from '../src/schema.js'

/**
 * Runs the real Drizzle SQL layer against PGlite (PostgreSQL compiled to WASM),
 * so the PostgreSQL stores are verified in every `pnpm test` run without Docker.
 * The same suites also run against a real server when TEST_DATABASE_URL is set
 * (see observation-store.test.ts / memory-store.test.ts).
 */
const schema = { observations, memories, memoryRevisions }

function makeObservation(id: string, overrides: Partial<Observation> = {}): Observation {
  return {
    id,
    pluginId: 'test-observer',
    sourceId: 'test.source',
    type: 'test.observation',
    timestamp: '2026-01-01T00:00:00.000Z',
    payload: { stage: 'lead' },
    correlationId: 'trace_1',
    ...overrides,
  }
}

function makeMemory(id: string, overrides: Partial<Memory> = {}): Memory {
  return {
    id,
    type: 'opportunity',
    content: { stage: 'lead' },
    sourceEventIds: ['obs_1'],
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    revision: 1,
    ...overrides,
  }
}

describe('drizzle stores on PGlite', () => {
  let observationStore: DrizzleObservationStore
  let memoryStore: DrizzleMemoryStore

  beforeAll(async () => {
    const db = drizzle(new PGlite(), { schema })
    await ensureSchema(db as unknown as PgSchemaDatabase)
    observationStore = new DrizzleObservationStore(db as unknown as PgSchemaDatabase)
    memoryStore = new DrizzleMemoryStore(db as unknown as PgSchemaDatabase)
  })

  it('roundtrips observations through jsonb and timestamptz', async () => {
    const observation = makeObservation('obs_1', { payload: { stage: 'lead', amount: 42 } })
    await observationStore.insert(observation)

    expect(await observationStore.get('obs_1')).toEqual(observation)
    expect(await observationStore.get('missing')).toBeUndefined()
  })

  it('filters and paginates observations newest first', async () => {
    await observationStore.insert(makeObservation('obs_2', { timestamp: '2026-01-02T10:00:00.000Z' }))
    await observationStore.insert(makeObservation('obs_3', { timestamp: '2026-01-03T10:00:00.000Z', type: 'other.type' }))

    const page = await observationStore.list({ pluginId: 'test-observer', limit: 2 })
    expect(page.items.map((item) => item.id)).toEqual(['obs_3', 'obs_2'])
    expect(page.nextCursor).toBe('2')

    const next = await observationStore.list({ pluginId: 'test-observer', limit: 2, cursor: '2' })
    expect(next.items.map((item) => item.id)).toEqual(['obs_1'])
    expect(next.nextCursor).toBeUndefined()

    const byType = await observationStore.list({ type: 'other.type', limit: 10 })
    expect(byType.items.map((item) => item.id)).toEqual(['obs_3'])

    const byRange = await observationStore.list({
      from: '2026-01-02T00:00:00.000Z',
      to: '2026-01-02T23:59:59.000Z',
      limit: 10,
    })
    expect(byRange.items.map((item) => item.id)).toEqual(['obs_2'])
  })

  it('stores memory revisions atomically with before/after/diff', async () => {
    await memoryStore.createWithRevision(makeMemory('mem_1'), {
      id: 'rev_1',
      memoryId: 'mem_1',
      revision: 1,
      timestamp: '2026-01-01T10:00:00.000Z',
      sourceEventIds: ['obs_1'],
      before: null,
      after: { stage: 'lead' },
      diff: { changed: [{ path: '$', before: null, after: { stage: 'lead' } }], added: [], removed: [] },
      reason: 'opportunity observed',
    })

    await memoryStore.updateWithRevision(
      makeMemory('mem_1', {
        content: { stage: 'negotiation' },
        sourceEventIds: ['obs_1', 'obs_2'],
        updatedAt: '2026-01-02T10:00:00.000Z',
        revision: 2,
      }),
      {
        id: 'rev_2',
        memoryId: 'mem_1',
        revision: 2,
        timestamp: '2026-01-02T10:00:00.000Z',
        sourceEventIds: ['obs_2'],
        before: { stage: 'lead' },
        after: { stage: 'negotiation' },
        diff: {
          changed: [{ path: 'stage', before: 'lead', after: 'negotiation' }],
          added: [],
          removed: [],
        },
        reason: 'stage changed',
      },
    )

    const memory = await memoryStore.get('mem_1')
    expect(memory).toMatchObject({ revision: 2, content: { stage: 'negotiation' } })
    expect(memory?.sourceEventIds).toEqual(['obs_1', 'obs_2'])

    const revisions = await memoryStore.listRevisions('mem_1')
    expect(revisions.map((revision) => revision.revision)).toEqual([1, 2])
    expect(revisions[1]?.diff).toEqual({
      changed: [{ path: 'stage', before: 'lead', after: 'negotiation' }],
      added: [],
      removed: [],
    })

    const timeline = await memoryStore.listRevisionsFiltered({ limit: 10 })
    expect(timeline.items.map((change) => change.memoryType)).toEqual(['opportunity', 'opportunity'])
    expect(timeline.items[0]?.revision.revision).toBe(2)
  })

  it('soft deletes memories and keeps the audit trail', async () => {
    await memoryStore.deleteWithRevision('mem_1', '2026-01-03T10:00:00.000Z', {
      id: 'rev_3',
      memoryId: 'mem_1',
      revision: 3,
      timestamp: '2026-01-03T10:00:00.000Z',
      sourceEventIds: [],
      before: { stage: 'negotiation' },
      after: null,
      diff: {
        changed: [{ path: '$', before: { stage: 'negotiation' }, after: null }],
        added: [],
        removed: [],
      },
    })

    expect(await memoryStore.get('mem_1')).toBeUndefined()
    expect(await memoryStore.exists('mem_1')).toBe(true)
    expect(await memoryStore.listRevisions('mem_1')).toHaveLength(3)
    expect((await memoryStore.list({ limit: 10 })).items).toEqual([])
  })
})
