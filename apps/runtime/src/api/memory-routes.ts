import type { FastifyInstance } from 'fastify'
import type { MemoryQuery, MemoryService } from '@fde-ai/domain'

export interface MemoryRouteOptions {
  memoryService: MemoryService
}

export function registerMemoryRoutes(app: FastifyInstance, options: MemoryRouteOptions): void {
  app.get<{ Querystring: MemoryQuery }>('/api/memories', async (request) => {
    return options.memoryService.list(request.query)
  })

  app.get<{ Params: { id: string } }>('/api/memories/:id', async (request) => {
    return options.memoryService.get(request.params.id)
  })

  app.get<{ Params: { id: string } }>('/api/memories/:id/revisions', async (request) => {
    return { items: await options.memoryService.revisions(request.params.id) }
  })
}
