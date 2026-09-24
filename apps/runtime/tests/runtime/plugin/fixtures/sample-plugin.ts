import type { Plugin } from '@fde-ai/domain'

export const plugin: Plugin = {
  manifest: {
    id: 'sample-fixture',
    name: 'Sample Fixture',
    version: '0.1.0',
    capabilities: { observationSources: ['sample.source'] },
  },
}
