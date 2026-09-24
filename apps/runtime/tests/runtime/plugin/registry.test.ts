import {
  DuplicatePluginError,
  InvalidLifecycleTransitionError,
  PluginNotFoundError,
  PluginRuntimeError,
} from '@fde-ai/domain'
import type { Logger, Plugin, PluginContext } from '@fde-ai/domain'
import { describe, expect, it } from 'vitest'
import { DefaultPluginRegistry, MemoryConfigService } from '../../../src/index.js'

const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} }

function makeContext(): PluginContext {
  return {
    logger: silentLogger,
    config: new MemoryConfigService({}),
    events: { publish: async () => {}, subscribe: () => () => {} },
    observations: {
      emit: async () => {
        throw new Error('not used in registry tests')
      },
      get: async () => {
        throw new Error('not used in registry tests')
      },
      list: async () => ({ items: [] }),
    },
  }
}

interface TestPluginOptions {
  id?: string
  onSetup?: (ctx: PluginContext) => Promise<void> | void
  onStart?: (ctx: PluginContext) => Promise<void> | void
  onStop?: (ctx: PluginContext) => Promise<void> | void
}

function makePlugin(options: TestPluginOptions = {}): Plugin {
  const id = options.id ?? 'test-plugin'
  return {
    manifest: { id, name: 'Test Plugin', version: '0.1.0', description: 'test fixture' },
    setup: options.onSetup,
    start: options.onStart,
    stop: options.onStop,
  }
}

function makeRegistry(now?: () => string): DefaultPluginRegistry {
  return new DefaultPluginRegistry({ context: makeContext(), now })
}

describe('DefaultPluginRegistry', () => {
  it('registers a plugin with status registered', () => {
    const registry = makeRegistry()
    registry.register(makePlugin())
    expect(registry.getStatus('test-plugin')).toBe('registered')
    expect(registry.list()).toHaveLength(1)
    expect(registry.list()[0]?.manifest.id).toBe('test-plugin')
  })

  it('rejects duplicate registration with a clear error', () => {
    const registry = makeRegistry()
    registry.register(makePlugin())
    expect(() => registry.register(makePlugin())).toThrow(DuplicatePluginError)
  })

  it('enable runs setup then start and ends enabled', async () => {
    const calls: string[] = []
    const registry = makeRegistry(() => '2026-01-01T00:00:00.000Z')
    registry.register(
      makePlugin({
        onSetup: () => {
          calls.push('setup')
        },
        onStart: () => {
          calls.push('start')
        },
      }),
    )
    await registry.enable('test-plugin')
    expect(calls).toEqual(['setup', 'start'])
    expect(registry.getStatus('test-plugin')).toBe('enabled')
    expect(registry.list()[0]?.startedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('enable is idempotent when already enabled', async () => {
    const registry = makeRegistry()
    registry.register(makePlugin())
    await registry.enable('test-plugin')
    await expect(registry.enable('test-plugin')).resolves.toBeUndefined()
    expect(registry.getStatus('test-plugin')).toBe('enabled')
  })

  it('disable runs stop and ends disabled', async () => {
    const calls: string[] = []
    const registry = makeRegistry(() => '2026-01-01T00:00:00.000Z')
    registry.register(
      makePlugin({
        onStop: () => {
          calls.push('stop')
        },
      }),
    )
    await registry.enable('test-plugin')
    await registry.disable('test-plugin')
    expect(calls).toEqual(['stop'])
    expect(registry.getStatus('test-plugin')).toBe('disabled')
    expect(registry.list()[0]?.stoppedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('disable is idempotent when already disabled', async () => {
    const registry = makeRegistry()
    registry.register(makePlugin())
    await registry.disable('test-plugin')
    await expect(registry.disable('test-plugin')).resolves.toBeUndefined()
    expect(registry.getStatus('test-plugin')).toBe('disabled')
  })

  it('a plugin can be re-enabled after disable', async () => {
    const registry = makeRegistry()
    registry.register(makePlugin())
    await registry.enable('test-plugin')
    await registry.disable('test-plugin')
    await registry.enable('test-plugin')
    expect(registry.getStatus('test-plugin')).toBe('enabled')
  })

  it('start failure transitions to error and records the cause', async () => {
    const registry = makeRegistry()
    registry.register(
      makePlugin({
        onStart: () => {
          throw new Error('boom')
        },
      }),
    )
    await expect(registry.enable('test-plugin')).rejects.toThrow(PluginRuntimeError)
    expect(registry.getStatus('test-plugin')).toBe('error')
    expect(registry.list()[0]?.lastError).toContain('boom')
  })

  it('stop failure transitions to error and records the cause', async () => {
    const registry = makeRegistry()
    registry.register(
      makePlugin({
        onStop: () => {
          throw new Error('stop-boom')
        },
      }),
    )
    await registry.enable('test-plugin')
    await expect(registry.disable('test-plugin')).rejects.toThrow(PluginRuntimeError)
    expect(registry.getStatus('test-plugin')).toBe('error')
    expect(registry.list()[0]?.lastError).toContain('stop-boom')
  })

  it('throws PluginNotFoundError for unknown ids', () => {
    const registry = makeRegistry()
    expect(() => registry.get('missing')).toThrow(PluginNotFoundError)
    expect(() => registry.getStatus('missing')).toThrow(PluginNotFoundError)
  })

  it('rejects concurrent enable/disable via the busy guard', async () => {
    const registry = makeRegistry()
    let releaseStart: (() => void) | undefined
    registry.register(
      makePlugin({
        onStart: () =>
          new Promise<void>((resolve) => {
            releaseStart = resolve
          }),
      }),
    )
    const first = registry.enable('test-plugin')
    await expect(registry.enable('test-plugin')).rejects.toThrow(InvalidLifecycleTransitionError)
    releaseStart?.()
    await first
  })
})
