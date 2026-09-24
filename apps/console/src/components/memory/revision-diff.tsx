'use client'

import type { DiffEntryDto, MemoryDiffDto } from '@fde-ai/api-client'

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Readability over technical format: each change renders as
 * `path` / `- before` / `+ after`, matching the Phase 1 diff shape.
 */
export function RevisionDiff({ diff }: { diff: MemoryDiffDto }) {
  const changed: DiffEntryDto[] = Array.isArray(diff.changed) ? diff.changed : []
  const added: DiffEntryDto[] = Array.isArray(diff.added) ? diff.added : []
  const removed: DiffEntryDto[] = Array.isArray(diff.removed) ? diff.removed : []

  if (changed.length === 0 && added.length === 0 && removed.length === 0) {
    return <p className="text-sm text-zinc-500">No field-level changes.</p>
  }

  return (
    <div className="flex flex-col gap-2 font-mono text-xs">
      {changed.map((entry) => (
        <div key={`changed-${entry.path}`} className="flex flex-col gap-0.5">
          <span className="text-zinc-500">{entry.path}</span>
          <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">- {formatValue(entry.before)}</span>
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
            + {formatValue(entry.after)}
          </span>
        </div>
      ))}
      {added.map((entry) => (
        <span key={`added-${entry.path}`} className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
          + {entry.path}: {formatValue(entry.after)}
        </span>
      ))}
      {removed.map((entry) => (
        <span key={`removed-${entry.path}`} className="rounded bg-red-50 px-2 py-0.5 text-red-700">
          - {entry.path}: {formatValue(entry.before)}
        </span>
      ))}
    </div>
  )
}
