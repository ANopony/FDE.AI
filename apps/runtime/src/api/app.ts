import Fastify, { type FastifyInstance } from 'fastify'
import type { MemoryService, ObservationService, PluginRegistry, TimelineService } from '@fde-ai/domain'
import type { DemoRouteOptions } from './demo-routes.js'
import { registerDemoRoutes } from './demo-routes.js'
import { mapDomainError } from './errors.js'
import { registerMemoryRoutes } from './memory-routes.js'
import { registerPluginRoutes } from './plugin-routes.js'
import { registerTimelineRoutes } from './timeline-routes.js'

export interface BuildAppOptions {
  observationService: ObservationService
  memoryService: MemoryService
  timelineService: TimelineService
  pluginRegistry: PluginRegistry
  /** Pass false in tests to silence the Fastify logger. */
  logger?: boolean
  /** Optional dev/demo harness (POST /api/demo/observations). */
  demo?: DemoRouteOptions
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true })

  app.setErrorHandler((error, request, reply) => {
    const mapped = mapDomainError(error)
    request.log.error({ err: error }, 'request failed')
    return reply.code(mapped.statusCode).send({ error: mapped.message })
  })

  app.get('/api/health', async () => ({ status: 'ok' }))

  registerTimelineRoutes(app, options)
  registerMemoryRoutes(app, options)
  registerPluginRoutes(app, options)
  if (options.demo) {
    registerDemoRoutes(app, options.demo)
  }

  return app
}
