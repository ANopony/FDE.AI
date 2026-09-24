import { InMemoryEventBus } from '@fde-ai/event-bus'
import type {
  EventBus,
  Logger,
  MemoryService,
  MemoryStore,
  ObservationService,
  ObservationStore,
  Plugin,
  TimelineService,
} from '@fde-ai/domain'
import { MemoryConfigService } from './config.js'
import { createLogger } from './logger.js'
import { DefaultMemoryService } from './memory/memory-service.js'
import { DefaultObservationService } from './observation/observation-service.js'
import { loadConfiguredPlugins } from './registry/loader.js'
import { DefaultPluginRegistry } from './registry/plugin-registry.js'
import { createStores } from './stores.js'
import { DefaultTimelineService } from './timeline/timeline-service.js'

export interface RuntimeOptions {
  config?: MemoryConfigService
  logger?: Logger
  eventBus?: EventBus
  observationStore?: ObservationStore
  observationService?: ObservationService
  memoryStore?: MemoryStore
  memoryService?: MemoryService
  timelineService?: TimelineService
}

export interface Runtime {
  config: MemoryConfigService
  logger: Logger
  eventBus: EventBus
  observationService: ObservationService
  memoryService: MemoryService
  timelineService: TimelineService
  registry: DefaultPluginRegistry
  loadPlugins(): Promise<Plugin[]>
}

/**
 * Wires config, logger, event bus, observation/memory services and the
 * plugin registry into the Phase 1 runtime. Missing stores/services default
 * to PostgreSQL-backed implementations from config key `database.url`.
 */
export async function createRuntime(options: RuntimeOptions = {}): Promise<Runtime> {
  const config = options.config ?? MemoryConfigService.fromEnv()
  const logger = options.logger ?? createLogger()
  const eventBus = options.eventBus ?? new InMemoryEventBus({ logger })

  let observationStore = options.observationStore
  let memoryStore = options.memoryStore
  if (!observationStore || !memoryStore) {
    const defaults = await createStores(config, logger)
    observationStore ??= defaults.observationStore
    memoryStore ??= defaults.memoryStore
  }

  const observationService =
    options.observationService ??
    new DefaultObservationService({ store: observationStore, bus: eventBus, logger })
  const memoryService =
    options.memoryService ?? new DefaultMemoryService({ store: memoryStore, bus: eventBus, logger })
  const timelineService =
    options.timelineService ?? new DefaultTimelineService({ observationStore, memoryStore, logger })

  const registry = new DefaultPluginRegistry({
    context: { logger, config, events: eventBus, observations: observationService },
  })
  return {
    config,
    logger,
    eventBus,
    observationService,
    memoryService,
    timelineService,
    registry,
    loadPlugins: () => loadConfiguredPlugins({ config, logger }),
  }
}

export { DefaultPluginRegistry } from './registry/plugin-registry.js'
export type { PluginRegistryOptions } from './registry/plugin-registry.js'
export { loadConfiguredPlugins, loadPluginModule } from './registry/loader.js'
export type { LoaderOptions } from './registry/loader.js'
export { MemoryConfigService, readFlagConfig, readListConfig } from './config.js'
export { MockAgentProcessor } from './agent/mock-processor.js'
export type { MockAgentProcessorOptions } from './agent/mock-processor.js'
export type { DemoRouteOptions } from './api/demo-routes.js'
export { createLogger } from './logger.js'
export { DefaultMemoryService } from './memory/memory-service.js'
export type { MemoryServiceOptions } from './memory/memory-service.js'
export { DefaultObservationService } from './observation/observation-service.js'
export type { ObservationServiceOptions } from './observation/observation-service.js'
export { createStores } from './stores.js'
export type { RuntimeStores } from './stores.js'
export { DefaultTimelineService } from './timeline/timeline-service.js'
export type { TimelineServiceOptions } from './timeline/timeline-service.js'
export { buildApp } from './api/app.js'
export type { BuildAppOptions } from './api/app.js'
export { InMemoryEventBus } from '@fde-ai/event-bus'
