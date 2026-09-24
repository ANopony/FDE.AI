import { z } from 'zod'
import type { MemoryRevision } from '../memory/memory.js'

export const TIMELINE_KINDS = ['observation', 'agent_event', 'memory_change'] as const

export type TimelineKind = (typeof TIMELINE_KINDS)[number]

/** Unified timeline view item; list responses never embed big payloads. */
export interface TimelineItem {
  id: string
  kind: TimelineKind
  timestamp: string
  source?: string
  pluginId?: string
  title: string
  summary?: string
  relatedIds: string[]
  detailRef: string
}

export const TimelineQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  kind: z.enum(TIMELINE_KINDS).optional(),
  pluginId: z.string().optional(),
  sourceId: z.string().optional(),
  memoryId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

/** Query as provided by callers: every filter optional, limit defaulted. */
export type TimelineQuery = z.input<typeof TimelineQuerySchema>
/** Query after normalization: limit is always present. */
export type TimelineQueryNormalized = z.output<typeof TimelineQuerySchema>

export interface TimelinePage {
  items: TimelineItem[]
  nextCursor?: string
}

/** A memory revision enriched with the memory type for timeline rendering. */
export interface TimelineMemoryChange {
  revision: MemoryRevision
  memoryType: string
}

export interface TimelineMemoryChangePage {
  items: TimelineMemoryChange[]
  nextCursor?: string
}

export interface TimelineService {
  query(query: TimelineQuery): Promise<TimelinePage>
}
