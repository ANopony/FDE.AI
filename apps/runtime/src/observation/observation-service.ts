import {
  EVENT_TYPES,
  ObservationInputSchema,
  ObservationNotFoundError,
  ObservationQuerySchema,
} from '@fde-ai/domain'
import type {
  EventBus,
  Logger,
  Observation,
  ObservationInput,
  ObservationPage,
  ObservationQuery,
  ObservationService,
  ObservationStore,
  RuntimeEvent,
} from '@fde-ai/domain'

export interface ObservationServiceOptions {
  store: ObservationStore
  bus: EventBus
  logger: Logger
  idFactory?: (prefix: string) => string
  now?: () => string
}

/**
 * emit = generate ids + fill timestamp -> persist -> publish -> return.
 * Chain: Plugin Observer -> ObservationService.emit() -> Event Store -> EventBus.
 */
export class DefaultObservationService implements ObservationService {
  private readonly idFactory: (prefix: string) => string
  private readonly now: () => string

  constructor(private readonly options: ObservationServiceOptions) {
    this.idFactory = options.idFactory ?? ((prefix) => `${prefix}_${crypto.randomUUID()}`)
    this.now = options.now ?? (() => new Date().toISOString())
  }

  async emit(input: ObservationInput): Promise<Observation> {
    const parsed = ObservationInputSchema.parse(input)
    const observation: Observation = {
      id: this.idFactory('obs'),
      pluginId: parsed.pluginId,
      sourceId: parsed.sourceId,
      type: parsed.type,
      timestamp: parsed.timestamp ?? this.now(),
      payload: parsed.payload,
      correlationId: parsed.correlationId ?? this.idFactory('trace'),
      metadata: parsed.metadata,
    }

    await this.options.store.insert(observation)

    const event: RuntimeEvent<Observation> = {
      id: this.idFactory('evt'),
      type: EVENT_TYPES.observationCreated,
      timestamp: observation.timestamp,
      source: observation.sourceId,
      correlationId: observation.correlationId,
      payload: observation,
    }
    await this.options.bus.publish(event)

    this.options.logger.info(
      { observationId: observation.id, eventId: event.id, pluginId: observation.pluginId },
      'observation persisted and published',
    )
    return observation
  }

  async get(id: string): Promise<Observation> {
    const observation = await this.options.store.get(id)
    if (!observation) {
      throw new ObservationNotFoundError(`Observation not found: ${id}`, id)
    }
    return observation
  }

  async list(query: ObservationQuery): Promise<ObservationPage> {
    const parsed = ObservationQuerySchema.parse(query)
    return this.options.store.list(parsed)
  }
}
