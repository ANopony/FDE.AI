'use client'

import { Button } from '@/components/ui/button'

export interface TimelineFilterValues {
  kind: string
  pluginId: string
  sourceId: string
  memoryId: string
  from: string
  to: string
}

export const EMPTY_FILTERS: TimelineFilterValues = {
  kind: '',
  pluginId: '',
  sourceId: '',
  memoryId: '',
  from: '',
  to: '',
}

export interface TimelineFiltersProps {
  value: TimelineFilterValues
  plugins: string[]
  onChange: (next: TimelineFilterValues) => void
  onReset: () => void
}

const inputClass = 'rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-900'

export function TimelineFilters({ value, plugins, onChange, onReset }: TimelineFiltersProps) {
  const set = (patch: Partial<TimelineFilterValues>) => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Event Kind
        <select className={inputClass} value={value.kind} onChange={(event) => set({ kind: event.target.value })}>
          <option value="">all</option>
          <option value="observation">observation</option>
          <option value="agent_event">agent_event</option>
          <option value="memory_change">memory_change</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Plugin
        <select
          className={inputClass}
          value={value.pluginId}
          onChange={(event) => set({ pluginId: event.target.value })}
        >
          <option value="">all</option>
          {plugins.map((pluginId) => (
            <option key={pluginId} value={pluginId}>
              {pluginId}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Source
        <input
          className={inputClass}
          value={value.sourceId}
          placeholder="e.g. test.source"
          onChange={(event) => set({ sourceId: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Memory ID
        <input
          className={inputClass}
          value={value.memoryId}
          placeholder="e.g. mem_123"
          onChange={(event) => set({ memoryId: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        From
        <input
          className={inputClass}
          type="datetime-local"
          value={value.from}
          onChange={(event) => set({ from: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        To
        <input
          className={inputClass}
          type="datetime-local"
          value={value.to}
          onChange={(event) => set({ to: event.target.value })}
        />
      </label>
      <Button onClick={onReset}>Reset</Button>
    </div>
  )
}
