import {
  DuplicatePluginError,
  InvalidLifecycleTransitionError,
  PluginNotFoundError,
  PluginRuntimeError,
} from '@fde-ai/domain'
import type { Plugin, PluginContext, PluginRegistry, PluginRuntimeInfo, PluginStatus } from '@fde-ai/domain'

interface PluginEntry {
  plugin: Plugin
  status: PluginStatus
  registeredAt: string
  startedAt?: string
  stoppedAt?: string
  lastActivityAt?: string
  lastError?: string
  errorCount: number
  /** Guards against concurrent enable/disable on the same plugin. */
  busy: boolean
}

export interface PluginRegistryOptions {
  context: PluginContext
  now?: () => string
}

/**
 * In-process Plugin registry implementing the Phase 1 lifecycle:
 * registered -> (enable) starting -> enabled -> (disable) stopping -> disabled,
 * with `error` when setup/start/stop throws. Errors are recorded, never swallowed.
 */
export class DefaultPluginRegistry implements PluginRegistry {
  private readonly entries = new Map<string, PluginEntry>()
  private readonly now: () => string

  constructor(private readonly options: PluginRegistryOptions) {
    this.now = options.now ?? (() => new Date().toISOString())
  }

  register(plugin: Plugin): void {
    const id = plugin.manifest.id
    if (this.entries.has(id)) {
      throw new DuplicatePluginError(`Plugin already registered: ${id}`, id)
    }
    this.entries.set(id, {
      plugin,
      status: 'registered',
      registeredAt: this.now(),
      errorCount: 0,
      busy: false,
    })
  }

  get(id: string): Plugin {
    return this.require(id).plugin
  }

  getInfo(id: string): PluginRuntimeInfo {
    return this.toInfo(this.require(id))
  }

  list(): PluginRuntimeInfo[] {
    return [...this.entries.values()].map((entry) => this.toInfo(entry))
  }

  getStatus(id: string): PluginStatus {
    return this.require(id).status
  }

  async enable(id: string): Promise<void> {
    const entry = this.require(id)
    if (entry.status === 'enabled') return
    if (entry.busy) throw this.busyError(id, entry.status)
    if (entry.status === 'starting' || entry.status === 'stopping') {
      throw new InvalidLifecycleTransitionError(`Plugin ${id} is ${entry.status}; enable not allowed`, id)
    }
    entry.busy = true
    entry.lastError = undefined
    entry.lastActivityAt = this.now()
    try {
      entry.status = 'starting'
      const ctx = this.options.context
      await entry.plugin.setup?.(ctx)
      await entry.plugin.start?.(ctx)
      entry.status = 'enabled'
      entry.startedAt = this.now()
    } catch (err) {
      entry.status = 'error'
      entry.errorCount += 1
      entry.lastError = err instanceof Error ? err.message : String(err)
      throw new PluginRuntimeError(`Plugin ${id} failed to enable`, id, { cause: err })
    } finally {
      entry.busy = false
    }
  }

  async disable(id: string): Promise<void> {
    const entry = this.require(id)
    if (entry.status === 'disabled') return
    if (entry.busy) throw this.busyError(id, entry.status)
    entry.lastActivityAt = this.now()
    if (entry.status === 'registered') {
      entry.status = 'disabled'
      return
    }
    if (entry.status === 'starting' || entry.status === 'stopping') {
      throw new InvalidLifecycleTransitionError(`Plugin ${id} is ${entry.status}; disable not allowed`, id)
    }
    entry.busy = true
    try {
      entry.status = 'stopping'
      await entry.plugin.stop?.(this.options.context)
      entry.status = 'disabled'
      entry.stoppedAt = this.now()
    } catch (err) {
      entry.status = 'error'
      entry.errorCount += 1
      entry.lastError = err instanceof Error ? err.message : String(err)
      throw new PluginRuntimeError(`Plugin ${id} failed to disable`, id, { cause: err })
    } finally {
      entry.busy = false
    }
  }

  private require(id: string): PluginEntry {
    const entry = this.entries.get(id)
    if (!entry) throw new PluginNotFoundError(`Plugin not found: ${id}`, id)
    return entry
  }

  private busyError(id: string, status: PluginStatus): InvalidLifecycleTransitionError {
    return new InvalidLifecycleTransitionError(
      `Plugin ${id} is busy (${status}); concurrent start/stop is not allowed`,
      id,
    )
  }

  private toInfo(entry: PluginEntry): PluginRuntimeInfo {
    const { plugin, status, registeredAt, startedAt, stoppedAt, lastActivityAt, lastError, errorCount } = entry
    return {
      manifest: plugin.manifest,
      status,
      registeredAt,
      startedAt,
      stoppedAt,
      lastActivityAt,
      lastError,
      errorCount,
    }
  }
}
