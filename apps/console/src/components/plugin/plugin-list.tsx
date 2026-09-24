'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiClient } from '@fde-ai/api-client'
import type { PluginSummary } from '@fde-ai/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PluginEnableToggle } from './plugin-enable-toggle'
import { PluginStatusBadge } from './plugin-status-badge'

function capabilitySummary(plugin: PluginSummary): string {
  const c = plugin.capabilities
  const parts: string[] = []
  if (c.services?.length) parts.push(`${c.services.length} services`)
  if (c.tools?.length) parts.push(`${c.tools.length} tools`)
  if (c.skills?.length) parts.push(`${c.skills.length} skills`)
  if (c.observationSources?.length) parts.push(`${c.observationSources.length} sources`)
  if (c.memoryHandlers?.length) parts.push(`${c.memoryHandlers.length} handlers`)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export function PluginList() {
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlugins(await apiClient.listPlugins())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function updatePlugin(updated: PluginSummary) {
    setPlugins((current) => current.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plugins</CardTitle>
        <Button onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Failed to load plugins: {error}
          </p>
        ) : null}
        {loading && plugins.length === 0 ? <p className="text-sm text-zinc-500">Loading plugins…</p> : null}
        {!loading && plugins.length === 0 && !error ? (
          <p className="text-sm text-zinc-500">No plugins registered.</p>
        ) : null}
        {plugins.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Capabilities</th>
                  <th className="py-2 pr-4 font-medium">Version</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Errors</th>
                  <th className="py-2 pr-4 font-medium">Last Activity</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map((plugin) => (
                  <tr key={plugin.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/plugins/${encodeURIComponent(plugin.id)}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {plugin.name}
                      </Link>
                      {plugin.description ? (
                        <div className="text-xs text-zinc-500">{plugin.description}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">{capabilitySummary(plugin)}</td>
                    <td className="py-2 pr-4 text-zinc-600">{plugin.version}</td>
                    <td className="py-2 pr-4">
                      <PluginStatusBadge status={plugin.status} />
                    </td>
                    <td className={`py-2 pr-4 ${plugin.errorCount > 0 ? 'text-red-600' : 'text-zinc-500'}`}>
                      {plugin.errorCount}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {plugin.lastActivity ? formatTime(plugin.lastActivity) : '—'}
                    </td>
                    <td className="py-2">
                      <PluginEnableToggle plugin={plugin} onChanged={updatePlugin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
