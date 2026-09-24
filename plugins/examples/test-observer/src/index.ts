import type { Observation, ObservationService, Plugin } from '@fde-ai/domain'

const ID = 'test-observer'
const SOURCE_ID = 'test.source'
const TYPE = 'test.observation'

export interface TestObserverPlugin extends Plugin {
  emit(payload?: unknown): Promise<Observation>
}

/**
 * Test Observation Plugin (sourceId = test.source, type = test.observation).
 * Tests call emit() directly to drive the Memory / E2E chains in later tasks.
 */
export function createTestObserverPlugin(): TestObserverPlugin {
  let observations: ObservationService | undefined
  return {
    manifest: {
      id: ID,
      name: 'Test Observer',
      version: '0.1.0',
      description: 'Emits test observations on demand for Memory/E2E tests',
      capabilities: {
        observationSources: [SOURCE_ID],
      },
    },
    async setup(ctx) {
      observations = ctx.observations
    },
    async start(ctx) {
      ctx.logger.info({ pluginId: ID }, 'test observer ready')
    },
    async stop(ctx) {
      observations = undefined
      ctx.logger.info({ pluginId: ID }, 'test observer stopped')
    },
    async emit(payload: unknown = {}) {
      if (!observations) {
        throw new Error(`${ID} is not enabled; enable it before emitting`)
      }
      return observations.emit({ pluginId: ID, sourceId: SOURCE_ID, type: TYPE, payload })
    },
  }
}

export const plugin = createTestObserverPlugin()
