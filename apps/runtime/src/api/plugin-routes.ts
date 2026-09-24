import type { FastifyInstance } from 'fastify'
import type { PluginRegistry, PluginRuntimeInfo } from '@fde-ai/domain'

export interface PluginRouteOptions {
  pluginRegistry: PluginRegistry
}

function toListItem(info: PluginRuntimeInfo) {
  return {
    id: info.manifest.id,
    name: info.manifest.name,
    description: info.manifest.description,
    version: info.manifest.version,
    status: info.status,
    capabilities: info.manifest.capabilities ?? {},
    lastActivity: info.lastActivityAt,
    errorCount: info.errorCount,
  }
}

export function registerPluginRoutes(app: FastifyInstance, options: PluginRouteOptions): void {
  app.get('/api/plugins', async () => {
    return { plugins: options.pluginRegistry.list().map(toListItem) }
  })

  app.get<{ Params: { id: string } }>('/api/plugins/:id', async (request) => {
    const info = options.pluginRegistry.getInfo(request.params.id)
    return {
      ...toListItem(info),
      manifest: info.manifest,
      lifecycle: {
        registeredAt: info.registeredAt,
        startedAt: info.startedAt,
        stoppedAt: info.stoppedAt,
      },
      lastError: info.lastError,
    }
  })

  app.post<{ Params: { id: string } }>('/api/plugins/:id/enable', async (request) => {
    await options.pluginRegistry.enable(request.params.id)
    return { id: request.params.id, status: options.pluginRegistry.getInfo(request.params.id).status }
  })

  app.post<{ Params: { id: string } }>('/api/plugins/:id/disable', async (request) => {
    await options.pluginRegistry.disable(request.params.id)
    return { id: request.params.id, status: options.pluginRegistry.getInfo(request.params.id).status }
  })
}
