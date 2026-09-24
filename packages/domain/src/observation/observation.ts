import { z } from 'zod'

export const ObservationSchema = z.object({
  id: z.string().min(1),
  pluginId: z.string().min(1),
  sourceId: z.string().min(1),
  type: z.string().min(1),
  timestamp: z.string().min(1),
  payload: z.unknown(),
  correlationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type Observation = z.infer<typeof ObservationSchema>

export const ObservationInputSchema = z.object({
  pluginId: z.string().min(1),
  sourceId: z.string().min(1),
  type: z.string().min(1),
  timestamp: z.string().optional(),
  payload: z.unknown(),
  correlationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type ObservationInput = z.infer<typeof ObservationInputSchema>

export const ObservationQuerySchema = z.object({
  pluginId: z.string().optional(),
  sourceId: z.string().optional(),
  type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

/** Query as provided by callers: every filter optional, limit defaulted. */
export type ObservationQuery = z.input<typeof ObservationQuerySchema>
/** Query after normalization: limit is always present. */
export type ObservationQueryNormalized = z.output<typeof ObservationQuerySchema>

export interface ObservationPage {
  items: Observation[]
  nextCursor?: string
}

/**
 * Standardized emit / get / list contract. `emit` generates ids and
 * timestamps, persists, publishes to the EventBus and returns the
 * standardized Observation.
 */
export interface ObservationService {
  emit(input: ObservationInput): Promise<Observation>
  get(id: string): Promise<Observation>
  list(query: ObservationQuery): Promise<ObservationPage>
}
