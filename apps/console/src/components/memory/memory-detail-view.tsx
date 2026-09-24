'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiClient } from '@fde-ai/api-client'
import type { MemoryDto, MemoryRevisionDto } from '@fde-ai/api-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RevisionDiff } from './revision-diff'

function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function formatContent(content: unknown): string {
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return String(content)
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-100 py-1.5 text-sm last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-mono text-xs">{value}</span>
    </div>
  )
}

/** Source evidence: every revision traces back to observations / agent events. */
function SourceEvidence({ eventIds }: { eventIds: string[] }) {
  if (eventIds.length === 0) {
    return <p className="text-sm text-zinc-500">No source events recorded.</p>
  }
  return (
    <ul className="flex flex-col gap-1">
      {eventIds.map((eventId) => (
        <li key={eventId} className="flex items-center gap-2 text-sm">
          <Link
            href={`/timeline?event=${encodeURIComponent(eventId)}`}
            className="font-mono text-xs text-blue-700 hover:underline"
            title="Open in Timeline (Timeline UI arrives in task 08)"
          >
            {eventId}
          </Link>
          <span className="text-xs text-zinc-400">view in timeline</span>
        </li>
      ))}
    </ul>
  )
}

export function MemoryDetailView({ id }: { id: string }) {
  const [memory, setMemory] = useState<MemoryDto | null>(null)
  const [revisions, setRevisions] = useState<MemoryRevisionDto[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [loadedMemory, loadedRevisions] = await Promise.all([
        apiClient.getMemory(id),
        apiClient.getMemoryRevisions(id),
      ])
      setMemory(loadedMemory)
      setRevisions(loadedRevisions)
      const last = loadedRevisions.at(-1)
      setSelected(last ? last.revision : null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load memory: {error}
        </p>
        <Link href="/memory" className="text-sm text-blue-700 hover:underline">
          ← Back to Memory
        </Link>
      </div>
    )
  }

  if (loading || !memory) {
    return <p className="text-sm text-zinc-500">Loading memory…</p>
  }

  const selectedRevision = revisions.find((revision) => revision.revision === selected) ?? null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Link href="/memory" className="text-sm text-zinc-500 hover:text-zinc-700">
              ← Memory
            </Link>
            <CardTitle>{memory.type}</CardTitle>
            <Badge className="bg-zinc-100 text-zinc-600">revision #{memory.revision}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-500">Current Content</div>
            <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs">
              {formatContent(memory.content)}
            </pre>
          </div>
          <div>
            <DetailRow label="ID" value={memory.id} />
            <DetailRow label="Type" value={memory.type} />
            <DetailRow
              label="Confidence"
              value={memory.confidence === undefined ? '—' : memory.confidence.toFixed(2)}
            />
            <DetailRow label="Created At" value={formatTime(memory.createdAt)} />
            <DetailRow label="Updated At" value={formatTime(memory.updatedAt)} />
            <DetailRow label="Revision" value={`#${memory.revision}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <SourceEvidence eventIds={memory.sourceEventIds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revision History</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row">
          <ol className="flex w-full flex-col gap-1 md:w-56">
            {[...revisions].reverse().map((revision) => {
              const active = revision.revision === selected
              return (
                <li key={revision.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(revision.revision)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                      active ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    Revision #{revision.revision}
                    <span className="block text-xs text-zinc-500">{formatTime(revision.timestamp)}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="flex-1">
            {selectedRevision ? (
              <div className="flex flex-col gap-3">
                <div>
                  <DetailRow label="Timestamp" value={formatTime(selectedRevision.timestamp)} />
                  <DetailRow label="Reason" value={selectedRevision.reason ?? '—'} />
                  <DetailRow
                    label="Source Event IDs"
                    value={selectedRevision.sourceEventIds.join(', ') || '—'}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-zinc-500">Before</div>
                    <pre className="overflow-x-auto rounded-md bg-red-50/50 p-2 text-xs">
                      {formatContent(selectedRevision.before)}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-zinc-500">After</div>
                    <pre className="overflow-x-auto rounded-md bg-emerald-50/50 p-2 text-xs">
                      {formatContent(selectedRevision.after)}
                    </pre>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-500">Diff</div>
                  <RevisionDiff diff={selectedRevision.diff} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Select a revision to inspect its diff.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
