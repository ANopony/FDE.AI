import type { FastifyInstance } from 'fastify'
import type { Observation } from '@fde-ai/domain'

export interface DemoRouteOptions {
  /**
   * Dev/demo harness: emits an observation through the test observer plugin,
   * so the demo works exactly like a real observer (and fails once the plugin
   * is disabled). Only registered when explicitly enabled by configuration.
   */
  emitObservation(payload: unknown): Promise<Observation>
}

export function registerDemoRoutes(app: FastifyInstance, options: DemoRouteOptions): void {
  app.post<{ Body: { payload?: unknown } | undefined }>('/api/demo/observations', async (request, reply) => {
    const observation = await options.emitObservation(request.body?.payload ?? {})
    return reply.code(201).send(observation)
  })
}
