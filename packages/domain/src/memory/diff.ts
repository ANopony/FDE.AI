export interface DiffEntry {
  path: string
  before?: unknown
  after?: unknown
}

/**
 * Readable, stable diff shape (no JSON Patch in Phase 1):
 * changed entries carry both sides, added/removed carry one side.
 */
export interface MemoryDiff {
  changed: DiffEntry[]
  added: DiffEntry[]
  removed: DiffEntry[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function joinPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key
}

export function computeDiff(before: unknown, after: unknown): MemoryDiff {
  return diffAt(before, after, '')
}

function diffAt(before: unknown, after: unknown, path: string): MemoryDiff {
  if (isPlainObject(before) && isPlainObject(after)) {
    const changed: DiffEntry[] = []
    const added: DiffEntry[] = []
    const removed: DiffEntry[] = []
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of keys) {
      const childPath = joinPath(path, key)
      const hasBefore = key in before
      const hasAfter = key in after
      if (hasBefore && hasAfter) {
        const sub = diffAt(before[key], after[key], childPath)
        changed.push(...sub.changed)
        added.push(...sub.added)
        removed.push(...sub.removed)
      } else if (hasAfter) {
        added.push({ path: childPath, after: after[key] })
      } else {
        removed.push({ path: childPath, before: before[key] })
      }
    }
    return { changed, added, removed }
  }
  if (!Object.is(before, after)) {
    return { changed: [{ path: path || '$', before, after }], added: [], removed: [] }
  }
  return { changed: [], added: [], removed: [] }
}
