import { z } from 'zod'

export const MemorySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  content: z.unknown(),
  /** At least one source event; Memory must never be a sourceless black box. */
  sourceEventIds: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  revision: z.number().int().positive(),
})

export type Memory = z.infer<typeof MemorySchema>

export const MemoryRevisionSchema = z.object({
  id: z.string().min(1),
  memoryId: z.string().min(1),
  revision: z.number().int().positive(),
  timestamp: z.string().min(1),
  sourceEventIds: z.array(z.string()),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  diff: z.unknown(),
  reason: z.string().optional(),
})

export type MemoryRevision = z.infer<typeof MemoryRevisionSchema>

export const MemoryCreateInputSchema = z.object({
  type: z.string().min(1),
  content: z.unknown(),
  sourceEventIds: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
})

export type MemoryCreateInput = z.infer<typeof MemoryCreateInputSchema>

export const MemoryUpdateInputSchema = z
  .object({
    content: z.unknown().optional(),
    confidence: z.number().min(0).max(1).optional(),
    sourceEventIds: z.array(z.string().min(1)).min(1).optional(),
    reason: z.string().optional(),
  })
  .refine(
    (value) =>
      value.content !== undefined || value.confidence !== undefined || value.sourceEventIds !== undefined,
    { message: 'at least one of content / confidence / sourceEventIds is required' },
  )

export type MemoryUpdateInput = z.infer<typeof MemoryUpdateInputSchema>

export const MemoryQuerySchema = z.object({
  type: z.string().optional(),
  updatedFrom: z.string().optional(),
  updatedTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

/** Query as provided by callers: every filter optional, limit defaulted. */
export type MemoryQuery = z.input<typeof MemoryQuerySchema>
/** Query after normalization: limit is always present. */
export type MemoryQueryNormalized = z.output<typeof MemoryQuerySchema>

export interface MemoryPage {
  items: Memory[]
  nextCursor?: string
}

export const MemoryRevisionQuerySchema = z.object({
  memoryId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

/** Query as provided by callers: every filter optional, limit defaulted. */
export type MemoryRevisionQuery = z.input<typeof MemoryRevisionQuerySchema>
/** Query after normalization: limit is always present. */
export type MemoryRevisionQueryNormalized = z.output<typeof MemoryRevisionQuerySchema>

export interface MemoryMutationEventPayload {
  memory: Memory
  revision: MemoryRevision
}

/**
 * Every mutation goes through this service so a MemoryRevision is always
 * produced. Business code must never bypass it to touch storage directly.
 */
export interface MemoryService {
  create(input: MemoryCreateInput): Promise<Memory>
  get(id: string): Promise<Memory>
  list(query: MemoryQuery): Promise<MemoryPage>
  update(id: string, input: MemoryUpdateInput): Promise<Memory>
  delete(id: string, reason?: string): Promise<MemoryRevision>
  revisions(id: string): Promise<MemoryRevision[]>
}
