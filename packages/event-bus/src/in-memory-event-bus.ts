import type { EventBus, EventHandler, Logger, RuntimeEvent } from '@fde-ai/domain'

export interface InMemoryEventBusOptions {
  logger?: Logger
}

/**
 * Phase 1 in-process event bus. A failing handler never blocks other
 * subscribers and is logged instead of being swallowed silently.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>()

  constructor(private readonly options: InMemoryEventBusOptions = {}) {}

  async publish(event: RuntimeEvent): Promise<void> {
    const handlers = [...(this.handlers.get(event.type) ?? [])]
    await Promise.all(
      handlers.map((handler) =>
        Promise.resolve()
          .then(() => handler(event))
          .catch((err: unknown) => {
            this.options.logger?.error(
              {
                eventType: event.type,
                eventId: event.id,
                error: err instanceof Error ? err.message : String(err),
              },
              'event handler failed',
            )
          }),
      ),
    )
  }

  subscribe(eventType: string, handler: EventHandler): () => void {
    let handlers = this.handlers.get(eventType)
    if (!handlers) {
      handlers = new Set()
      this.handlers.set(eventType, handlers)
    }
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }
}
