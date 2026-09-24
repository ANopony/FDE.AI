import type { PluginManifest, PluginStatus } from '@fde-ai/domain'

export interface PluginCapabilities {
  services?: string[]
  tools?: string[]
  skills?: string[]
  observationSources?: string[]
  memoryHandlers?: string[]
}

export interface PluginSummary {
  id: string
  name: string
  description?: string
  version: string
  status: PluginStatus
  capabilities: PluginCapabilities
  lastActivity?: string
  errorCount: number
}

export interface PluginLifecycle {
  registeredAt?: string
  startedAt?: string
  stoppedAt?: string
}

export interface PluginDetail extends PluginSummary {
  manifest: PluginManifest
  lifecycle: PluginLifecycle
  lastError?: string
}

export interface PluginActionResult {
  id: string
  status: PluginStatus
}

export interface TimelineItemDto {
  id: string
  kind: 'observation' | 'agent_event' | 'memory_change'
  timestamp: string
  source?: string
  pluginId?: string
  title: string
  summary?: string
  relatedIds: string[]
  detailRef: string
}

export interface TimelineQuery {
  from?: string
  to?: string
  kind?: string
  pluginId?: string
  sourceId?: string
  memoryId?: string
  limit?: number
  cursor?: string
}

export interface ObservationDto {
  id: string
  pluginId: string
  sourceId: string
  type: string
  timestamp: string
  payload: unknown
  correlationId?: string
  metadata?: Record<string, unknown>
}

export interface TimelinePageDto {
  items: TimelineItemDto[]
  nextCursor?: string
}

export interface MemoryDto {
  id: string
  type: string
  content: unknown
  sourceEventIds: string[]
  confidence?: number
  createdAt: string
  updatedAt: string
  revision: number
}

export interface DiffEntryDto {
  path: string
  before?: unknown
  after?: unknown
}

export interface MemoryDiffDto {
  changed: DiffEntryDto[]
  added: DiffEntryDto[]
  removed: DiffEntryDto[]
}

export interface MemoryRevisionDto {
  id: string
  memoryId: string
  revision: number
  timestamp: string
  sourceEventIds: string[]
  before: unknown
  after: unknown
  diff: MemoryDiffDto
  reason?: string
}

export interface MemoryPageDto {
  items: MemoryDto[]
  nextCursor?: string
}

export interface MemoryQuery {
  type?: string
  updatedFrom?: string
  updatedTo?: string
  limit?: number
  cursor?: string
}
