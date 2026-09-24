import type { Observation, Plugin } from '@fde-ai/domain'
import { MockAgentProcessor } from './agent/mock-processor.js'
import { buildApp } from './api/app.js'
import { readFlagConfig, readListConfig } from './config.js'
import { createRuntime } from './index.js'

interface ObservingPlugin {
  emit(payload?: unknown): Promise<Observation>
}

function asObservingPlugin(plugin: Plugin): ObservingPlugin | undefined {
  const candidate = plugin as Partial<ObservingPlugin>
  return typeof candidate.emit === 'function' ? (candidate as ObservingPlugin) : undefined
}

/**
 * Starts the Phase 1 runtime: PostgreSQL-backed stores, plugin loading,
 * optional mock agent processor and the REST API.
 */
export async function startServer(): Promise<void> {
  const runtime = await createRuntime()

  const plugins = await runtime.loadPlugins()
  for (const plugin of plugins) {
    runtime.registry.register(plugin)
  }
  for (const requested of readListConfig(runtime.config, 'plugin.autoenable')) {
    const ids = requested === '*' ? plugins.map((plugin) => plugin.manifest.id) : [requested]
    for (const id of ids) {
      if (runtime.registry.list().some((info) => info.manifest.id === id)) {
        await runtime.registry.enable(id)
      }
    }
  }

  const processor = readFlagConfig(runtime.config, 'agent.mock.enabled')
    ? new MockAgentProcessor({
        bus: runtime.eventBus,
        memory: runtime.memoryService,
        logger: runtime.logger,
      })
    : undefined
  processor?.start()

  const demoPlugin = plugins.map(asObservingPlugin).find((plugin) => plugin !== undefined)
  const demo =
    readFlagConfig(runtime.config, 'demo.endpoints') && demoPlugin
      ? { emitObservation: (payload: unknown) => demoPlugin.emit(payload) }
      : undefined

  const app = buildApp({
    observationService: runtime.observationService,
    memoryService: runtime.memoryService,
    timelineService: runtime.timelineService,
    pluginRegistry: runtime.registry,
    demo,
  })

  const port = Number(runtime.config.get('server.port') ?? 3000)
  const host = String(runtime.config.get('server.host') ?? '127.0.0.1')
  await app.listen({ port, host })
  runtime.logger.info(
    {
      port,
      host,
      plugins: plugins.map((plugin) => plugin.manifest.id),
      mockAgent: processor !== undefined,
      demoEndpoints: demo !== undefined,
    },
    'fde runtime listening',
  )
}

startServer().catch((err: unknown) => {
  console.error('fde runtime failed to start', err)
  process.exitCode = 1
})
