import type {
  MemoryDto,
  MemoryPageDto,
  MemoryQuery,
  MemoryRevisionDto,
  ObservationDto,
  PluginActionResult,
  PluginDetail,
  PluginSummary,
  TimelinePageDto,
  TimelineQuery,
} from './types.js'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface FdeApiClientOptions {
  /** Base path for the FDE runtime API; defaults to same-origin /api (proxied by the Console). */
  baseUrl?: string
  fetchImpl?: typeof fetch
}

/**
 * Typed REST client for the FDE runtime API. The Console never talks to the
 * database; everything goes through these endpoints.
 */
export class FdeApiClient {
  constructor(private readonly options: FdeApiClientOptions = {}) {}

  private get baseUrl(): string {
    return this.options.baseUrl ?? '/api'
  }

  async listPlugins(): Promise<PluginSummary[]> {
    const body = await this.request<{ plugins: PluginSummary[] }>('/plugins')
    return body.plugins
  }

  async getPlugin(id: string): Promise<PluginDetail> {
    return this.request<PluginDetail>(`/plugins/${encodeURIComponent(id)}`)
  }

  async enablePlugin(id: string): Promise<PluginActionResult> {
    return this.request<PluginActionResult>(`/plugins/${encodeURIComponent(id)}/enable`, { method: 'POST' })
  }

  async disablePlugin(id: string): Promise<PluginActionResult> {
    return this.request<PluginActionResult>(`/plugins/${encodeURIComponent(id)}/disable`, { method: 'POST' })
  }

  async getTimeline(query: TimelineQuery = {}): Promise<TimelinePageDto> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value))
    }
    const qs = params.size > 0 ? `?${params.toString()}` : ''
    return this.request<TimelinePageDto>(`/timeline${qs}`)
  }

  async getObservation(id: string): Promise<ObservationDto> {
    return this.request<ObservationDto>(`/observations/${encodeURIComponent(id)}`)
  }

  async listMemories(query: MemoryQuery = {}): Promise<MemoryPageDto> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value))
    }
    const qs = params.size > 0 ? `?${params.toString()}` : ''
    return this.request<MemoryPageDto>(`/memories${qs}`)
  }

  async getMemory(id: string): Promise<MemoryDto> {
    return this.request<MemoryDto>(`/memories/${encodeURIComponent(id)}`)
  }

  async getMemoryRevisions(id: string): Promise<MemoryRevisionDto[]> {
    const body = await this.request<{ items: MemoryRevisionDto[] }>(
      `/memories/${encodeURIComponent(id)}/revisions`,
    )
    return body.items
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const fetchImpl = this.options.fetchImpl ?? fetch
    const response = await fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      // Fastify rejects empty JSON bodies: only declare content-type when a body exists.
      headers:
        init.body !== undefined ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    })
    if (!response.ok) {
      let message = `request failed with status ${response.status}`
      try {
        const body = (await response.json()) as { error?: string }
        if (body.error) message = body.error
      } catch {
        // non-JSON error body; keep the status message
      }
      throw new ApiError(response.status, message)
    }
    return (await response.json()) as T
  }
}

/** Shared default instance; the Console rewrites /api/* to the runtime. */
export const apiClient = new FdeApiClient()
