import { InMemoryMemoryStore, InMemoryObservationStore } from '@fde-ai/database'
import type { RuntimeEvent } from '@fde-ai/domain'
import { InMemoryEventBus } from '@fde-ai/event-bus'
import { plugin as testObserver } from '@fde-ai/plugin-test-observer'
import { MockAgentProcessor, buildApp, createRuntime } from '@fde-ai/runtime'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Phase 1 E2E chain (task 09):
 * Plugin -> Observation -> Agent Event -> Memory -> Revision -> Timeline,
 * then Plugin disabled -> no further observations.
 */

const logger = { debug() {}, info() {}, warn() {}, error() {} }

type HarnessApp = ReturnType<typeof buildApp>

interface Harness {
  app: HarnessApp
  runtime: Awaited<ReturnType<typeof createRuntime>>
  observationStore: InMemoryObservationStore
  memoryStore: InMemoryMemoryStore
  agentEvents: RuntimeEvent[]
}

async function createHarness(): Promise<Harness> {
  const observationStore = new InMemoryObservationStore()
  const memoryStore = new InMemoryMemoryStore()
  const eventBus = new InMemoryEventBus({ logger })
  const runtime = await createRuntime({ logger, eventBus, observationStore, memoryStore })
  const agentEvents: RuntimeEvent[] = []
  eventBus.subscribe('agent.completed', (event) => {
    agentEvents.push(event)
  })

  const processor = new MockAgentProcessor({ bus: eventBus, memory: runtime.memoryService, logger })
  processor.start()

  const app = buildApp({
    observationService: runtime.observationService,
    memoryService: runtime.memoryService,
    timelineService: runtime.timelineService,
    pluginRegistry: runtime.registry,
    demo: { emitObservation: (payload: unknown) => testObserver.emit(payload) },
    logger: false,
  })

  runtime.registry.register(testObserver)
  return { app, runtime, observationStore, memoryStore, agentEvents }
}

let current: Harness | undefined

afterEach(async () => {
  // Test data cleanup: in-memory stores are discarded per test, and the HTTP
  // server is closed so no socket or timer leaks into the next test.
  await current?.app.close()
  current = undefined
})

describe('phase 1 full loop', () => {
  it('runs plugin -> observation -> agent -> memory -> revision -> timeline -> disable', async () => {
    const harness = await createHarness()
    current = harness
    const { app, runtime, observationStore } = harness

    // 1. enable the observer plugin through the API
    const enabled = await app.inject({ method: 'POST', url: '/api/plugins/test-observer/enable' })
    expect(enabled.json()).toMatchObject({ status: 'enabled' })

    // 2. observer delivers a new opportunity
    const firstEmit = await app.inject({
      method: 'POST',
      url: '/api/demo/observations',
      payload: { payload: { customer: 'Acme', stage: 'lead' } },
    })
    expect(firstEmit.statusCode).toBe(201)
    const firstObservation = firstEmit.json<{ id: string }>()

    // 3. mock agent turned it into memory revision #1
    const memories = await runtime.memoryService.list({ type: 'opportunity' })
    expect(memories.items).toHaveLength(1)
    const memory = memories.items[0]
    expect(memory).toMatchObject({ revision: 1, content: { customer: 'Acme', stage: 'lead' } })
    expect(memory?.sourceEventIds).toEqual([firstObservation.id])
    expect(harness.agentEvents.map((event) => (event.payload as { action: string }).action)).toEqual([
      'create_memory',
    ])

    // 4. stage change -> revision #2 with a readable diff
    const secondEmit = await app.inject({
      method: 'POST',
      url: '/api/demo/observations',
      payload: { payload: { customer: 'Acme', stage: 'negotiation' } },
    })
    expect(secondEmit.statusCode).toBe(201)
    const revisions = await runtime.memoryService.revisions(memory?.id ?? '')
    expect(revisions.map((revision) => revision.revision)).toEqual([1, 2])
    expect(revisions[1]?.reason).toBe('stage changed from lead to negotiation')
    expect(revisions[1]?.diff).toEqual({
      changed: [{ path: 'stage', before: 'lead', after: 'negotiation' }],
      added: [],
      removed: [],
    })

    // 5. timeline exposes the whole evidence chain, newest first
    const timeline = await app.inject({ method: 'GET', url: '/api/timeline' })
    const items = timeline.json<{ items: Array<{ kind: string; id: string; relatedIds: string[] }> }>().items
    expect(items.map((item) => item.kind)).toEqual([
      'memory_change',
      'observation',
      'memory_change',
      'observation',
    ])
    expect(items[0]?.relatedIds[0]).toBe(memory?.id)

    // 6. memory detail + revisions are reachable from the API
    const detail = await app.inject({ method: 'GET', url: `/api/memories/${memory?.id}` })
    expect(detail.json<{ revision: number }>().revision).toBe(2)
    const revisionResponse = await app.inject({
      method: 'GET',
      url: `/api/memories/${memory?.id}/revisions`,
    })
    expect(revisionResponse.json<{ items: unknown[] }>().items).toHaveLength(2)

    // 7. disabling the plugin stops new observations
    const disabled = await app.inject({ method: 'POST', url: '/api/plugins/test-observer/disable' })
    expect(disabled.json()).toMatchObject({ status: 'disabled' })

    const observationsBefore = observationStore.size
    const blockedEmit = await app.inject({
      method: 'POST',
      url: '/api/demo/observations',
      payload: { payload: { customer: 'Acme', stage: 'won' } },
    })
    expect(blockedEmit.statusCode).toBe(500)
    expect(blockedEmit.json<{ error: string }>().error).toContain('not enabled')
    expect(observationStore.size).toBe(observationsBefore)

    const timelineAfter = await app.inject({ method: 'GET', url: '/api/timeline' })
    expect(timelineAfter.json<{ items: unknown[] }>().items).toHaveLength(4)
  })
})
