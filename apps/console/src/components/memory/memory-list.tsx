'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiClient } from '@fde-ai/api-client'
import type { MemoryDto } from '@fde-ai/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function summarize(content: unknown): string {
  if (typeof content === 'string') return content.length > 120 ? `${content.slice(0, 120)}…` : content
  try {
    const text = JSON.stringify(content)
    if (text === undefined) return String(content)
    return text.length > 120 ? `${text.slice(0, 120)}…` : text
  } catch {
    return String(content)
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function toIso(localValue: string): string | undefined {
  if (!localValue) return undefined
  const date = new Date(localValue)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function MemoryList() {
  const [type, setType] = useState('')
  const [updatedFrom, setUpdatedFrom] = useState('')
  const [updatedTo, setUpdatedTo] = useState('')
  const [memories, setMemories] = useState<MemoryDto[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      setError(null)
      try {
        const page = await apiClient.listMemories({
          type: type || undefined,
          updatedFrom: toIso(updatedFrom),
          updatedTo: toIso(updatedTo),
          limit: 50,
          cursor,
        })
        setMemories((current) => (cursor ? [...current, ...page.items] : page.items))
        setNextCursor(page.nextCursor)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [type, updatedFrom, updatedTo],
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory</CardTitle>
        <Button onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Type
            <input
              value={type}
              onChange={(event) => setType(event.target.value)}
              placeholder="e.g. opportunity"
              className="rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Updated from
            <input
              type="datetime-local"
              value={updatedFrom}
              onChange={(event) => setUpdatedFrom(event.target.value)}
              className="rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Updated to
            <input
              type="datetime-local"
              value={updatedTo}
              onChange={(event) => setUpdatedTo(event.target.value)}
              className="rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-900"
            />
          </label>
          <Button
            variant="default"
            onClick={() => {
              setType('')
              setUpdatedFrom('')
              setUpdatedTo('')
            }}
          >
            Reset
          </Button>
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Failed to load memories: {error}
          </p>
        ) : null}
        {loading && memories.length === 0 ? <p className="text-sm text-zinc-500">Loading memories…</p> : null}
        {!loading && memories.length === 0 && !error ? (
          <p className="text-sm text-zinc-500">No memories match the current filters.</p>
        ) : null}

        {memories.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Content</th>
                  <th className="py-2 pr-4 font-medium">Confidence</th>
                  <th className="py-2 pr-4 font-medium">Updated At</th>
                  <th className="py-2 pr-4 font-medium">Rev</th>
                  <th className="py-2 font-medium">Sources</th>
                </tr>
              </thead>
              <tbody>
                {memories.map((memory) => (
                  <tr key={memory.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/memory/${encodeURIComponent(memory.id)}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {memory.type}
                      </Link>
                      <div className="font-mono text-xs text-zinc-400">{memory.id}</div>
                    </td>
                    <td className="max-w-md py-2 pr-4 font-mono text-xs text-zinc-600">
                      {summarize(memory.content)}
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">
                      {memory.confidence === undefined ? '—' : memory.confidence.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">{formatTime(memory.updatedAt)}</td>
                    <td className="py-2 pr-4 text-zinc-600">#{memory.revision}</td>
                    <td className="py-2 text-zinc-600">{memory.sourceEventIds.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {nextCursor ? (
          <div className="flex justify-center">
            <Button onClick={() => void load(nextCursor)} disabled={loading}>
              Load more
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
