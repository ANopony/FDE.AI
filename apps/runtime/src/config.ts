import type { ConfigService } from '@fde-ai/domain'

/** Reads a list config value, tolerating comma-separated strings from env vars. */
export function readListConfig(config: ConfigService, key: string): string[] {
  const value = config.get<unknown>(key)
  if (Array.isArray(value)) {
    return value.map(String).filter((entry) => entry.length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  }
  return []
}

/** Reads a boolean flag config value ('true' / 1 / true). */
export function readFlagConfig(config: ConfigService, key: string, fallback = false): boolean {
  const value = config.get<unknown>(key)
  if (value === undefined || value === null || value === '') return fallback
  return value === true || value === 'true' || value === '1'
}

/** Simple in-memory ConfigService. Phase 1 config stays small. */
export class MemoryConfigService implements ConfigService {
  constructor(private readonly values: Record<string, unknown>) {}

  /**
   * Reads env vars prefixed with `FDE_` into dotted config keys:
   * FDE_DATABASE_URL -> `database.url`, FDE_PLUGIN_ENTRIES -> `plugin.entries`,
   * FDE_PLUGIN_AUTOENABLE -> `plugin.autoenable`, FDE_STORE_DRIVER -> `store.driver`.
   */
  static fromEnv(prefix = 'FDE_'): MemoryConfigService {
    const values: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix) && value !== undefined) {
        values[key.slice(prefix.length).toLowerCase().replace(/_/g, '.')] = value
      }
    }
    return new MemoryConfigService(values)
  }

  get<T = unknown>(key: string): T | undefined {
    return this.values[key] as T | undefined
  }

  getRequired<T = unknown>(key: string): T {
    const value = this.values[key]
    if (value === undefined) {
      throw new Error(`Missing required config key: ${key}`)
    }
    return value as T
  }

  has(key: string): boolean {
    return this.values[key] !== undefined
  }
}
