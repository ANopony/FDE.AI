import type { FastifyInstance } from 'fastify'
import type { ObservationService, TimelineQuery, TimelineService } from '@fde-ai/domain'

export interface TimelineRouteOptions {
  timelineService: TimelineService
  observationService: ObservationService
}

export function registerTimelineRoutes(app: FastifyInstance, options: TimelineRouteOptions): void {
  app.get<{ Querystring: TimelineQuery }>('/api/timeline', async (request) => {
    return options.timelineService.query(request.query)
  })

  app.get<{ Params: { id: string } }>('/api/observations/:id', async (request) => {
    return options.observationService.get(request.params.id)
  })
}
