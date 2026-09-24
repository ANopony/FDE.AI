import type { EventBus } from '../event/types.js'
import type { ObservationService } from '../observation/observation.js'
import type { PluginManifest } from './manifest.js'

/** Minimal structured logger (Pino-compatible call shape). */
export interface Logger {
  debug(obj: Record<string, unknown>, msg?: string): void
  info(obj: Record<string, unknown>, msg?: string): void
  warn(obj: Record<string, unknown>, msg?: string): void
  error(obj: Record<string, unknown>, msg?: string): void
}

/** Key/value configuration access for Plugins. */
export interface ConfigService {
  get<T = unknown>(key: string): T | undefined
  getRequired<T = unknown>(key: string): T
  has(key: string): boolean
}

/** Context handed to Plugins during setup/start/stop. */
export interface PluginContext {
  logger: Logger
  config: ConfigService
  events: EventBus
  observations: ObservationService
}

/** A Runtime extension unit. Plugin !== Tool !== Skill. */
export interface Plugin {
  manifest: PluginManifest
  setup?(ctx: PluginContext): Promise<void> | void
  start?(ctx: PluginContext): Promise<void> | void
  stop?(ctx: PluginContext): Promise<void> | void
}
