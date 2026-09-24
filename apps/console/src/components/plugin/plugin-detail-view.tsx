'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiClient } from '@fde-ai/api-client'
import type { PluginCapabilities, PluginDetail, PluginSummary } from '@fde-ai/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PluginEnableToggle } from './plugin-enable-toggle'
import { PluginStatusBadge } from './plugin-status-badge'

const CAPABILITY_GROUPS: Array<{ label: string; key: keyof PluginCapabilities }> = [
  { label: 'Services', key: 'services' },
  { label: 'Tools', key: 'tools' },
  { label: 'Skills', key: 'skills' },
  { label: 'Observation Sources', key: 'observationSources' },
  { label: 'Memory Handlers', key: 'memoryHandlers' },
]

function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function CapabilitySection({ capabilities }: { capabilities: PluginCapabilities }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capabilities</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CAPABILITY_GROUPS.map(({ label, key }) => {
          const values = capabilities[key] ?? []
          return (
            <div key={key}>
              <div className="mb-1 text-xs font-medium text-zinc-500">
                {label} ({values.length})
              </div>
              {values.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {values.map((value) => (
                    <span key={value} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      {value}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-400">none declared</div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-zinc-100 py-1.5 text-sm last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  )
}

export function PluginDetailView({ id }: { id: string }) {
  const [plugin, setPlugin] = useState<PluginDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlugin(await apiClient.getPlugin(id))
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
          Failed to load plugin: {error}
        </p>
        <Link href="/plugins" className="text-sm text-blue-700 hover:underline">
          ← Back to Plugins
        </Link>
      </div>
    )
  }

  if (loading || !plugin) {
    return <p className="text-sm text-zinc-500">Loading plugin…</p>
  }

  function updatePlugin(updated: PluginSummary) {
    setPlugin((current) => (current ? { ...current, status: updated.status } : current))
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Link href="/plugins" className="text-sm text-zinc-500 hover:text-zinc-700">
              ← Plugins
            </Link>
            <CardTitle>{plugin.name}</CardTitle>
            <PluginStatusBadge status={plugin.status} />
          </div>
          <PluginEnableToggle plugin={plugin} onChanged={updatePlugin} />
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {plugin.description ? <p className="text-sm text-zinc-600">{plugin.description}</p> : null}
          <p className="text-sm text-zinc-500">
            id <span className="font-mono text-xs">{plugin.id}</span> · version {plugin.version}
          </p>
        </CardContent>
      </Card>

      <CapabilitySection capabilities={plugin.capabilities} />

      <Card>
        <CardHeader>
          <CardTitle>Manifest</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs">
            {JSON.stringify(plugin.manifest, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runtime</CardTitle>
        </CardHeader>
        <CardContent>
          <RuntimeRow label="Status" value={plugin.status} />
          <RuntimeRow label="Registered At" value={formatTime(plugin.lifecycle.registeredAt)} />
          <RuntimeRow label="Started At" value={formatTime(plugin.lifecycle.startedAt)} />
          <RuntimeRow label="Stopped At" value={formatTime(plugin.lifecycle.stoppedAt)} />
          <RuntimeRow label="Last Activity" value={formatTime(plugin.lastActivity)} />
          <RuntimeRow label="Error Count" value={String(plugin.errorCount)} />
          <RuntimeRow label="Last Error" value={plugin.lastError ?? '—'} />
        </CardContent>
      </Card>
    </div>
  )
}
