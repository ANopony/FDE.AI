import { describe, expect, it } from 'vitest'
import { computeDiff } from '../src/index.js'

describe('computeDiff', () => {
  it('reports a changed leaf with a dot path for nested objects', () => {
    const diff = computeDiff(
      { stage: 'lead', contact: { name: 'A' } },
      { stage: 'opportunity', contact: { name: 'A' } },
    )
    expect(diff.changed).toEqual([{ path: 'stage', before: 'lead', after: 'opportunity' }])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
  })

  it('reports added and removed keys', () => {
    const diff = computeDiff({ a: 1, gone: true }, { a: 1, b: 2, nested: { x: 1 } })
    expect(diff.added).toEqual([
      { path: 'b', after: 2 },
      { path: 'nested', after: { x: 1 } },
    ])
    expect(diff.removed).toEqual([{ path: 'gone', before: true }])
    expect(diff.changed).toEqual([])
  })

  it('returns an empty diff for equal values', () => {
    expect(computeDiff({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toEqual({
      changed: [],
      added: [],
      removed: [],
    })
  })

  it('handles create (null before) and delete (null after)', () => {
    expect(computeDiff(null, { stage: 'lead' })).toEqual({
      changed: [{ path: '$', before: null, after: { stage: 'lead' } }],
      added: [],
      removed: [],
    })
    expect(computeDiff({ stage: 'lead' }, null)).toEqual({
      changed: [{ path: '$', before: { stage: 'lead' }, after: null }],
      added: [],
      removed: [],
    })
  })

  it('treats arrays as leaf values', () => {
    const diff = computeDiff({ tags: ['a'] }, { tags: ['a', 'b'] })
    expect(diff.changed).toEqual([{ path: 'tags', before: ['a'], after: ['a', 'b'] }])
  })
})
