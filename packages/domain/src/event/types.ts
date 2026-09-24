/**
 * Phase 1 event envelope. Every event must be traceable via id / type /
 * timestamp / source / correlationId.
 */
export interface RuntimeEvent<T = unknown> {
  id: string
  type: string
  timestamp: string
  source?: string
  correlationId?: string
  payload: T
}

export const EVENT_TYPES = {
  observationCreated: 'observation.created',
  agentCompleted: 'agent.completed',
  memoryCreated: 'memory.created',
  memoryUpdated: 'memory.updated',
  memoryDeleted: 'memory.deleted',
} as const

export type RuntimeEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES]

export type EventHandler = (event: RuntimeEvent) => Promise<void> | void

/**
 * In-process event bus contract. Business code depends on this interface,
 * never on a concrete implementation (Phase 1 ships InMemoryEventBus).
 */
export interface EventBus {
  publish(event: RuntimeEvent): Promise<void>
  /** Returns an unsubscribe function. */
  subscribe(eventType: string, handler: EventHandler): () => void
}
