'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ApiError, apiClient } from '@fde-ai/api-client'
import type { MemoryRevisionDto, ObservationDto, TimelineItemDto } from '@fde-ai/api-client'
import { Badge } from '@/components/ui/badge'
import { RevisionDiff } from '@/components/memory/revision-diff'

const KIND_STYLES: Record<TimelineItemDto['kind'], string> = {
  observation: 'bg-blue-100 text-blue-700',
  agent_event: 'bg-purple-100 text-purple-700',
  memory_change: 'bg-emerald-100 text-emerald-700',
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-100 py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="text-right font-mono text-xs">{value}</span>
    </div>
  )
}

function ObservationDetail({ observation }: { observation: ObservationDto }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Row label="Plugin" value={observation.pluginId} />
        <Row label="Source" value={observation.sourceId} />
        <Row label="Type" value={observation.type} />
        <Row label="Timestamp" value={formatTime(observation.timestamp)} />
        <Row label="Correlation ID" value={observation.correlationId ?? '—'} />
        {observation.metadata ? <Row label="Metadata" value={formatValue(observation.metadata)} /> : null}
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-zinc-500">Payload</div>
        <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs">
          {formatValue(observation.payload)}
        </pre>
      </div>
      <Link href={`/plugins/${encodeURIComponent(observation.pluginId)}`} className="text-sm text-blue-700 hover:underline">
        Open Plugin Detail →
      </Link>
    </div>
  )
}

function MemoryChangeDetail({ memoryId, revision }: { memoryId: string; revision: MemoryRevisionDto }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Row label="Memory ID" value={memoryId} />
        <Row label="Revision" value={`#${revision.revision}`} />
        <Row label="Timestamp" value={formatTime(revision.timestamp)} />
        <Row label="Reason" value={revision.reason ?? '—'} />
        <Row
          label="Source Event IDs"
          value={revision.sourceEventIds.length > 0 ? revision.sourceEventIds.join(', ') : '—'}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-500">Before</div>
          <pre className="overflow-x-auto rounded-md bg-red-50/50 p-2 text-xs">
            {formatValue(revision.before)}
          </pre>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-500">After</div>
          <pre className="overflow-x-auto rounded-md bg-emerald-50/50 p-2 text-xs">
            {formatValue(revision.after)}
          </pre>
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-zinc-500">Diff</div>
        <RevisionDiff diff={revision.diff} />
      </div>
      <Link href={`/memory/${encodeURIComponent(memoryId)}`} className="text-sm text-blue-700 hover:underline">
        Open Memory Detail →
      </Link>
    </div>
  )
}

export interface TimelineItemProps {
  item: TimelineItemDto
  defaultExpanded?: boolean
}

/**
 * One timeline entry. Detail is loaded from the detail endpoints on expand,
 * so filters never need to change to inspect a record.
 */
export function TimelineItem({ item, defaultExpanded = false }: TimelineItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [observation, setObservation] = useState<ObservationDto | null>(null)
  const [revision, setRevision] = useState<MemoryRevisionDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const memoryId = item.kind === 'memory_change' ? (item.source ?? item.relatedIds[0] ?? '') : ''

  async function toggle() {
    const next = !expanded
    setExpanded(next)
    if (!next || loading || observation || revision) return
    setLoading(true)
    setError(null)
    try {
      if (item.kind === 'observation') {
        setObservation(await apiClient.getObservation(item.id))
      } else if (item.kind === 'memory_change') {
        const revisions = await apiClient.getMemoryRevisions(memoryId)
        setRevision(revisions.find((candidate) => candidate.id === item.id) ?? null)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border border-zinc-200">
      <button
        type="button"
        onClick={() => void toggle()}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-50"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-400">{formatTime(item.timestamp)}</span>
            <Badge className={KIND_STYLES[item.kind]}>{item.kind}</Badge>
          </div>
          <div className="truncate text-sm font-medium">{item.title}</div>
          <div className="truncate text-xs text-zinc-500">
            {item.pluginId ? `${item.pluginId} · ` : ''}
            {item.source ?? ''}
            {item.summary ? ` · ${item.summary}` : ''}
          </div>
        </div>
        <span className="shrink-0 text-xs text-zinc-400">{expanded ? 'collapse' : 'details'}</span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 px-3 py-3">
          {loading ? <p className="text-sm text-zinc-500">Loading detail…</p> : null}
          {error ? <p className="text-sm text-red-600">Failed to load detail: {error}</p> : null}
          {observation ? <ObservationDetail observation={observation} /> : null}
          {revision ? <MemoryChangeDetail memoryId={memoryId} revision={revision} /> : null}
          {!loading && !error && !observation && !revision ? (
            <p className="text-sm text-zinc-500">
              No detail available for this event kind yet (agent events arrive with the Core Agent).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
