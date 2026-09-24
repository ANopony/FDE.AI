'use client'

import { useState } from 'react'
import { ApiError, apiClient } from '@fde-ai/api-client'
import type { PluginSummary } from '@fde-ai/api-client'
import { Button } from '@/components/ui/button'

export interface PluginEnableToggleProps {
  plugin: PluginSummary
  onChanged: (updated: PluginSummary) => void
}

/**
 * Enable/Disable button reflecting async states (enabling… / disabling…)
 * and surfacing failures inline instead of failing silently.
 */
export function PluginEnableToggle({ plugin, onChanged }: PluginEnableToggleProps) {
  const [pending, setPending] = useState<'enable' | 'disable' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const enabled = plugin.status === 'enabled'
  const busy = plugin.status === 'starting' || plugin.status === 'stopping'

  async function toggle() {
    const action = enabled ? 'disable' : 'enable'
    setPending(action)
    setError(null)
    try {
      const result = enabled ? await apiClient.disablePlugin(plugin.id) : await apiClient.enablePlugin(plugin.id)
      onChanged({ ...plugin, status: result.status })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={enabled ? 'default' : 'primary'}
        disabled={busy || pending !== null}
        onClick={() => void toggle()}
      >
        {pending === 'enable' ? 'enabling…' : pending === 'disable' ? 'disabling…' : enabled ? 'Disable' : 'Enable'}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
