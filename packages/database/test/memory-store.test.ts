import type { Memory, MemoryRevision } from '@fde-ai/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../src/index.js'
import { DrizzleMemoryStore, closeDb, createDb } from '../src/index.js'
import { deleteTestMemories, ensureTestSchema } from './helpers.js'

// Runs against a real PostgreSQL when TEST_DATABASE_URL is set, e.g.
// docker compose up -d db
// TEST_DATABASE_URL=postgres://fde:fde@localhost:5432/fde pnpm test
const maybe = describe.skipIf(!process.env.TEST_DATABASE_URL)

function makeMemory(id: string, overrides: Partial<Memory> = {}): Memory {
  return {
    id,
    type: 'opportunity',
    content: { stage: 'lead' },
    sourceEventIds: ['evt_1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    ...overrides,
  }
}

function makeRevision(memoryId: string, revision: number, overrides: Partial<MemoryRevision> = {}): MemoryRevision {
  return {
    id: `rev_${memoryId}_${revision}`,
    memoryId,
    revision,
    timestamp: '2026-01-01T00:00:00.000Z',
    sourceEventIds: ['evt_1'],
    before: null,
    after: { stage: 'lead' },
    diff: { changed: [{ path: '$', before: null, after: { stage: 'lead' } }], added: [], removed: [] },
    ...overrides,
  }
}

maybe('DrizzleMemoryStore (PostgreSQL)', () => {
  let db: Database
  let store: DrizzleMemoryStore

  beforeAll(async () => {
    db = createDb(process.env.TEST_DATABASE_URL as string)
    await ensureTestSchema(db)
    await deleteTestMemories(db)
    store = new DrizzleMemoryStore(db)
  })

  afterAll(async () => {
    await deleteTestMemories(db)
    await closeDb(db)
  })

  it('createWithRevision then get roundtrips content and sourceEventIds', async () => {
    const memory = makeMemory('mem_db_1', { sourceEventIds: ['evt_1', 'evt_2'], confidence: 0.8 })

    await store.createWithRevision(memory, makeRevision('mem_db_1', 1, { sourceEventIds: ['evt_1', 'evt_2'] }))

    expect(await store.get('mem_db_1')).toEqual(memory)
  })

  it('updateWithRevision bumps revision and keeps ordered revisions with diff', async () => {
    await store.createWithRevision(makeMemory('mem_db_2'), makeRevision('mem_db_2', 1))
    const updated = makeMemory('mem_db_2', {
      content: { stage: 'negotiation' },
      updatedAt: '2026-01-02T00:00:00.000Z',
      revision: 2,
    })
    const revision2 = makeRevision('mem_db_2', 2, {
      timestamp: '2026-01-02T00:00:00.000Z',
      before: { stage: 'lead' },
      after: { stage: 'negotiation' },
      diff: { changed: [{ path: 'stage', before: 'lead', after: 'negotiation' }], added: [], removed: [] },
    })

    await store.updateWithRevision(updated, revision2)
    const revisions = await store.listRevisions('mem_db_2')

    expect(revisions).toHaveLength(2)
    expect(revisions.map((r) => r.revision)).toEqual([1, 2])
    expect(revisions[1]?.diff).toEqual(revision2.diff)
    expect((await store.get('mem_db_2'))?.revision).toBe(2)
  })

  it('deleteWithRevision hides the memory but keeps it queryable for audit', async () => {
    await store.createWithRevision(makeMemory('mem_db_3'), makeRevision('mem_db_3', 1))
    const deletion = makeRevision('mem_db_3', 2, { after: null, before: { stage: 'lead' } })

    await store.deleteWithRevision('mem_db_3', '2026-01-03T00:00:00.000Z', deletion)

    expect(await store.get('mem_db_3')).toBeUndefined()
    expect(await store.exists('mem_db_3')).toBe(true)
    const revisions = await store.listRevisions('mem_db_3')
    expect(revisions).toHaveLength(2)
    expect(revisions[1]?.after).toBeNull()
  })

  it('list filters by type and excludes deleted memories', async () => {
    await store.createWithRevision(makeMemory('mem_db_4', { type: 'customer' }), makeRevision('mem_db_4', 1))
    await store.createWithRevision(
      makeMemory('mem_db_5', { type: 'customer', updatedAt: '2026-02-01T00:00:00.000Z' }),
      makeRevision('mem_db_5', 1),
    )
    await store.deleteWithRevision('mem_db_4', '2026-02-02T00:00:00.000Z', makeRevision('mem_db_4', 2))

    const page = await store.list({ type: 'customer', limit: 10 })

    expect(page.items.map((m) => m.id)).toEqual(['mem_db_5'])
  })

  it('listRevisionsFiltered joins the memory type and returns newest first', async () => {
    await store.createWithRevision(makeMemory('mem_db_6', { type: 'customer' }), makeRevision('mem_db_6', 1))
    await store.updateWithRevision(
      makeMemory('mem_db_6', { type: 'customer', revision: 2, updatedAt: '2026-01-02T00:00:00.000Z' }),
      makeRevision('mem_db_6', 2, { timestamp: '2026-01-02T00:00:00.000Z' }),
    )

    const page = await store.listRevisionsFiltered({ memoryId: 'mem_db_6', limit: 10 })

    expect(page.items.map((c) => c.revision.revision)).toEqual([2, 1])
    expect(page.items.every((c) => c.memoryType === 'customer')).toBe(true)
  })
})
