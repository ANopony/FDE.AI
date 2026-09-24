'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ApiError, apiClient } from '@fde-ai/api-client'
import type { TimelineItemDto, TimelineQuery } from '@fde-ai/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EMPTY_FILTERS, TimelineFilters } from './timeline-filters'
import type { TimelineFilterValues } from './timeline-filters'
import { TimelineItem } from './timeline-item'

function toIso(localValue: string): string | undefined {
  if (!localValue) return undefined
  const date = new Date(localValue)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function TimelineView() {
  const searchParams = useSearchParams()
  const focusEventId = searchParams.get('event')
  const [filters, setFilters] = useState<TimelineFilterValues>({
    ...EMPTY_FILTERS,
    memoryId: searchParams.get('memoryId') ?? '',
  })
  const [items, setItems] = useState<TimelineItemDto[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [plugins, setPlugins] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo<TimelineQuery>(
    () => ({
      kind: filters.kind || undefined,
      pluginId: filters.pluginId || undefined,
      sourceId: filters.sourceId || undefined,
      memoryId: filters.memoryId || undefined,
      from: toIso(filters.from),
      to: toIso(filters.to),
      limit: 50,
    }),
    [filters],
  )

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      setError(null)
      try {
        const page = await apiClient.getTimeline({ ...query, cursor })
        setItems((current) => (cursor ? [...current, ...page.items] : page.items))
        setNextCursor(page.nextCursor)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [query],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    apiClient
      .listPlugins()
      .then((list) => setPlugins(list.map((plugin) => plugin.id)))
      .catch(() => setPlugins([]))
  }, [])

  const focusVisible = focusEventId ? items.some((item) => item.id === focusEventId) : false

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
        <Button onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TimelineFilters
          value={filters}
          plugins={plugins}
          onChange={setFilters}
          onReset={() => setFilters(EMPTY_FILTERS)}
        />

        {focusEventId ? (
          <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Focused event <span className="font-mono text-xs">{focusEventId}</span>
            {focusVisible
              ? ' — its detail is expanded below.'
              : ' is not part of the current result window; adjust or reset the filters to locate it.'}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Failed to load timeline: {error}
          </p>
        ) : null}
        {loading && items.length === 0 ? <p className="text-sm text-zinc-500">Loading timeline…</p> : null}
        {!loading && items.length === 0 && !error ? (
          <p className="text-sm text-zinc-500">No events match the current filters.</p>
        ) : null}

        {items.length > 0 ? (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <TimelineItem key={`${item.kind}-${item.id}`} item={item} defaultExpanded={item.id === focusEventId} />
            ))}
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
