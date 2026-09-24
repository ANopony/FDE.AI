import { EVENT_TYPES } from '@fde-ai/domain'
import type {
  EventBus,
  Logger,
  Memory,
  MemoryService,
  Observation,
  RuntimeEvent,
} from '@fde-ai/domain'

export interface MockAgentProcessorOptions {
  bus: EventBus
  memory: MemoryService
  logger: Logger
  /** Memory type used for opportunities derived from observations. */
  memoryType?: string
  /** Source whose observations this processor interprets. */
  sourceId?: string
  idFactory?: (prefix: string) => string
}

interface OpportunityPayload {
  customer?: string
  opportunityId?: string
  stage?: string
}

/**
 * Phase 1 stand-in for the Core Agent. It subscribes to `observation.created`,
 * interprets opportunity-like observations, and drives the Memory Service so a
 * full chain (Observation -> Agent Event -> Memory -> Revision) is demonstrable
 * before the real agent exists.
 */
export class MockAgentProcessor {
  private unsubscribe: (() => void) | undefined
  private readonly memoryType: string
  private readonly sourceId: string
  private readonly idFactory: (prefix: string) => string

  constructor(private readonly options: MockAgentProcessorOptions) {
    this.memoryType = options.memoryType ?? 'opportunity'
    this.sourceId = options.sourceId ?? 'test.source'
    this.idFactory = options.idFactory ?? ((prefix) => `${prefix}_${crypto.randomUUID()}`)
  }

  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = this.options.bus.subscribe(EVENT_TYPES.observationCreated, (event) =>
      this.handle(event),
    )
    this.options.logger.info({ memoryType: this.memoryType, sourceId: this.sourceId }, 'mock agent processor started')
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  private async handle(event: RuntimeEvent): Promise<void> {
    const observation = event.payload as Observation | undefined
    if (!observation || observation.sourceId !== this.sourceId) return

    const payload = (observation.payload ?? {}) as OpportunityPayload
    if (typeof payload.stage !== 'string') return

    // Agent event: the interpretation step is observable on the bus.
    const agentEventId = this.idFactory('agent')
    try {
      const memory = await this.applyToMemory(observation, payload)
      await this.options.bus.publish({
        id: agentEventId,
        type: EVENT_TYPES.agentCompleted,
        timestamp: new Date().toISOString(),
        source: 'mock-agent-processor',
        correlationId: observation.correlationId,
        payload: {
          action: memory.created ? 'create_memory' : 'update_memory',
          observationId: observation.id,
          memoryId: memory.memory.id,
          revision: memory.memory.revision,
        },
      })
      this.options.logger.info(
        { observationId: observation.id, memoryId: memory.memory.id, revision: memory.memory.revision },
        'mock agent processed observation',
      )
    } catch (err) {
      this.options.logger.error(
        {
          observationId: observation.id,
          error: err instanceof Error ? err.message : String(err),
        },
        'mock agent failed to process observation',
      )
    }
  }

  private async applyToMemory(
    observation: Observation,
    payload: OpportunityPayload,
  ): Promise<{ memory: Memory; created: boolean }> {
    const existing = await this.findOpportunityMemory(payload)
    if (!existing) {
      const created = await this.options.memory.create({
        type: this.memoryType,
        content: { ...payload },
        sourceEventIds: [observation.id],
        reason: 'opportunity observed',
      })
      return { memory: created, created: true }
    }

    const content = { ...(existing.content as Record<string, unknown>), ...payload }
    const previousStage = (existing.content as OpportunityPayload).stage
    const updated = await this.options.memory.update(existing.id, {
      content,
      sourceEventIds: [observation.id],
      reason:
        previousStage && previousStage !== payload.stage
          ? `stage changed from ${previousStage} to ${payload.stage ?? previousStage}`
          : 'opportunity updated',
    })
    return { memory: updated, created: false }
  }

  private async findOpportunityMemory(payload: OpportunityPayload): Promise<Memory | undefined> {
    const page = await this.options.memory.list({ type: this.memoryType, limit: 200 })
    return page.items.find((memory) => {
      const content = memory.content as OpportunityPayload
      if (payload.opportunityId) return content.opportunityId === payload.opportunityId
      return content.customer === payload.customer
    })
  }
}
