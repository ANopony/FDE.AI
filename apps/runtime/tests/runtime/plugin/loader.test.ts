import type { Logger } from '@fde-ai/domain'
import { describe, expect, it } from 'vitest'
import { MemoryConfigService, loadConfiguredPlugins, loadPluginModule } from '../../../src/index.js'

const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} }
const fixtureUrl = new URL('./fixtures/sample-plugin.ts', import.meta.url).href

describe('loadPluginModule', () => {
  it('loads a plugin from a module with a named plugin export', async () => {
    const plugin = await loadPluginModule(fixtureUrl, {
      config: new MemoryConfigService({}),
      logger: silentLogger,
    })
    expect(plugin.manifest.id).toBe('sample-fixture')
    expect(plugin.manifest.capabilities?.observationSources).toEqual(['sample.source'])
  })

  it('rejects a module that does not export a plugin', async () => {
    const url = new URL('./fixtures/not-a-plugin.ts', import.meta.url).href
    await expect(
      loadPluginModule(url, { config: new MemoryConfigService({}), logger: silentLogger }),
    ).rejects.toThrow(/does not export a plugin/)
  })

  it('rejects a plugin with an invalid manifest', async () => {
    const url = new URL('./fixtures/bad-manifest.ts', import.meta.url).href
    await expect(
      loadPluginModule(url, { config: new MemoryConfigService({}), logger: silentLogger }),
    ).rejects.toThrow()
  })
})

describe('loadConfiguredPlugins', () => {
  it('loads plugins listed in the plugin.entries config key', async () => {
    const config = new MemoryConfigService({ 'plugin.entries': [fixtureUrl] })
    const plugins = await loadConfiguredPlugins({ config, logger: silentLogger })
    expect(plugins).toHaveLength(1)
    expect(plugins[0]?.manifest.id).toBe('sample-fixture')
  })

  it('returns an empty list when no entries are configured', async () => {
    const plugins = await loadConfiguredPlugins({ config: new MemoryConfigService({}), logger: silentLogger })
    expect(plugins).toEqual([])
  })
})
