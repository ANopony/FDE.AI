import { describe, expect, it } from 'vitest'
import { validateManifest } from '../src/index.js'

describe('validateManifest', () => {
  it('accepts a minimal manifest', () => {
    const manifest = validateManifest({ id: 'demo', name: 'Demo', version: '0.1.0' })
    expect(manifest.id).toBe('demo')
    expect(manifest.capabilities).toBeUndefined()
  })

  it('parses declared capabilities', () => {
    const manifest = validateManifest({
      id: 'demo-observer',
      name: 'Demo Observer',
      version: '0.1.0',
      capabilities: { observationSources: ['demo.opportunity'] },
    })
    expect(manifest.capabilities?.observationSources).toEqual(['demo.opportunity'])
  })

  it('rejects a manifest without an id', () => {
    expect(() => validateManifest({ name: 'NoId', version: '0.1.0' })).toThrow()
  })

  it('preserves unknown fields for forward compatibility', () => {
    const manifest = validateManifest({ id: 'crm', name: 'CRM', version: '0.1.0', author: 'FDE.AI' })
    expect((manifest as unknown as Record<string, unknown>).author).toBe('FDE.AI')
  })
})
