/**
 * FDE.AI Phase 1 demo — runs the full loop with in-memory stores (no database
 * required): Plugin -> Observation -> Agent Event -> Memory -> Revision -> Timeline.
 *
 * Usage: node scripts/demo/run-demo.mjs
 */
import assert from 'node:assert/strict'
import { InMemoryMemoryStore, InMemoryObservationStore } from '../../packages/database/dist/index.js'
import { InMemoryEventBus } from '../../packages/event-bus/dist/index.js'
import { createRuntime, MockAgentProcessor } from '../../apps/runtime/dist/index.js'
import { plugin as testObserver } from '../../plugins/examples/test-observer/dist/index.js'

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} }
const step = (n, text) => console.log(`\n[${String(n).padStart(2, '0')}] ${text}`)
const show = (label, value) => console.log(`     ${label}: ${JSON.stringify(value)}`)

const observationStore = new InMemoryObservationStore()
const memoryStore = new InMemoryMemoryStore()
const eventBus = new InMemoryEventBus({ logger: silentLogger })
const runtime = await createRuntime({
  logger: silentLogger,
  eventBus,
  observationStore,
  memoryStore,
})

// Agent events are observable on the bus (Phase 1 has no agent event store yet).
const agentEvents = []
eventBus.subscribe('agent.completed', (event) => agentEvents.push(event))

const processor = new MockAgentProcessor({
  bus: eventBus,
  memory: runtime.memoryService,
  logger: silentLogger,
})
processor.start()

step(1, 'Runtime started with in-memory stores')
step(2, 'Register the Test Observer plugin')
runtime.registry.register(testObserver)
show('status', runtime.registry.getStatus('test-observer'))

step(3, 'Enable the plugin (Discovered -> Enabled)')
await runtime.registry.enable('test-observer')
show('status', runtime.registry.getStatus('test-observer'))

step(4, 'Observer sees a new opportunity (10:00)')
const first = await testObserver.emit({ customer: 'Acme', stage: 'lead' })
show('observation', { id: first.id, sourceId: first.sourceId, type: first.type })
await new Promise((resolve) => setTimeout(resolve, 10))

step(5, 'Agent processed the observation -> Memory created')
const memories = await runtime.memoryService.list({ type: 'opportunity' })
assert.equal(memories.items.length, 1)
const memory = memories.items[0]
show('memory', { id: memory.id, type: memory.type, content: memory.content, revision: memory.revision })
show('agent events', agentEvents.map((event) => event.payload.action))

step(6, 'Revision #1 (create) is recorded with evidence')
const revisionsAfterCreate = await runtime.memoryService.revisions(memory.id)
show('revision #1', {
  before: revisionsAfterCreate[0].before,
  after: revisionsAfterCreate[0].after,
  sourceEventIds: revisionsAfterCreate[0].sourceEventIds,
})

step(7, 'Opportunity stage changes (10:05)')
const second = await testObserver.emit({ customer: 'Acme', stage: 'negotiation' })
show('observation', { id: second.id, type: second.type })
await new Promise((resolve) => setTimeout(resolve, 10))

step(8, 'Memory updated -> Revision #2 with a readable diff')
const updated = await runtime.memoryService.get(memory.id)
assert.equal(updated.revision, 2)
const revisions = await runtime.memoryService.revisions(memory.id)
const latest = revisions[revisions.length - 1]
show('current content', updated.content)
show('reason', latest.reason)
show('diff', latest.diff)

step(9, 'Timeline shows the full chain, newest first')
const timeline = await runtime.timelineService.query({})
for (const item of timeline.items) {
  show(item.kind, `${item.timestamp} ${item.title}${item.summary ? ` — ${item.summary}` : ''}`)
}
assert.equal(timeline.items.length, 4)
assert.deepEqual(
  timeline.items.map((item) => item.kind),
  ['memory_change', 'observation', 'memory_change', 'observation'],
)

step(10, 'Memory evidence resolves back to the observations')
const timelineObservationIds = timeline.items.filter((i) => i.kind === 'observation').map((i) => i.id)
assert.deepEqual(new Set(timelineObservationIds), new Set([first.id, second.id]))
show('source events of revision #2', revisions[1].sourceEventIds)

step(11, 'Disable the plugin (Enabled -> Disabled)')
await runtime.registry.disable('test-observer')
show('status', runtime.registry.getStatus('test-observer'))

step(12, 'Disabled plugin produces no further observations')
const observationsBefore = observationStore.size
await assert.rejects(() => testObserver.emit({ customer: 'Acme', stage: 'won' }), /not enabled/)
assert.equal(observationStore.size, observationsBefore)
show('observation count', `${observationStore.size} (unchanged)`)

step(13, 'Demo complete — observations, memories, revisions and timeline are consistent')
console.log('\nAll demo steps passed.')
