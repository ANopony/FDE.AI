import type { Logger, RuntimeEvent } from '@fde-ai/domain'
import { describe, expect, it } from 'vitest'
import { InMemoryEventBus } from '../src/index.js'

const logger: Logger = { debug() {}, info() {}, warn() {}, error() {} }

function makeEvent(type = 'test.event'): RuntimeEvent {
  return { id: 'evt_1', type, timestamp: '2026-01-01T00:00:00.000Z', payload: {} }
}

describe('InMemoryEventBus', () => {
  it('delivers to subscribers (sync and async) and unsubscribe stops delivery', async () => {
    const bus = new InMemoryEventBus({ logger })
    const received: string[] = []
    const unsubscribe = bus.subscribe('test.event', async (event) => {
      received.push(event.id)
    })
    await bus.publish(makeEvent())
    expect(received).toEqual(['evt_1'])
    unsubscribe()
    await bus.publish(makeEvent())
    expect(received).toEqual(['evt_1'])
  })

  it('only delivers to subscribers of the published event type', async () => {
    const bus = new InMemoryEventBus({ logger })
    const received: string[] = []
    bus.subscribe('other.event', () => {
      received.push('other')
    })
    await bus.publish(makeEvent())
    expect(received).toEqual([])
  })

  it('isolates handler failures and logs them', async () => {
    const errors: string[] = []
    const recording: Logger = {
      ...logger,
      error: (obj) => {
        errors.push(String(obj.error))
      },
    }
    const bus = new InMemoryEventBus({ logger: recording })
    const received: string[] = []
    bus.subscribe('test.event', () => {
      throw new Error('boom')
    })
    bus.subscribe('test.event', () => {
      received.push('ok')
    })
    await expect(bus.publish(makeEvent())).resolves.toBeUndefined()
    expect(received).toEqual(['ok'])
    expect(errors).toEqual(['boom'])
  })

  it('publish with no subscribers resolves', async () => {
    const bus = new InMemoryEventBus({ logger })
    await expect(bus.publish(makeEvent())).resolves.toBeUndefined()
  })
})
