import type { PluginManifest } from './manifest.js'
import type { Plugin } from './plugin.js'
import type { PluginStatus } from './status.js'

export interface PluginRuntimeInfo {
  manifest: PluginManifest
  status: PluginStatus
  registeredAt?: string
  startedAt?: string
  stoppedAt?: string
  lastActivityAt?: string
  lastError?: string
  errorCount: number
}

/**
 * Central Plugin lifecycle entry point. Plugins must not mutate the registry
 * themselves; all state transitions go through enable/disable.
 */
export interface PluginRegistry {
  register(plugin: Plugin): void
  get(id: string): Plugin
  getInfo(id: string): PluginRuntimeInfo
  list(): PluginRuntimeInfo[]
  getStatus(id: string): PluginStatus
  enable(id: string): Promise<void>
  disable(id: string): Promise<void>
}
