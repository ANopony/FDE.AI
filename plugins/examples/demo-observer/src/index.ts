import type { Plugin } from '@fde-ai/domain'

const ID = 'demo-observer'

/**
 * Minimal demo plugin for the Phase 1 runtime.
 * Task 01 only wires the lifecycle; the Observation Source arrives in Task 02.
 */
export const plugin: Plugin = {
  manifest: {
    id: ID,
    name: 'Demo Observer',
    version: '0.1.0',
    description: 'Demo plugin that will observe demo business changes',
    capabilities: {
      observationSources: ['demo.opportunity'],
    },
  },
  async setup(ctx) {
    ctx.logger.info({ pluginId: ID }, 'setup complete')
  },
  async start(ctx) {
    ctx.logger.info({ pluginId: ID }, 'observation sources starting')
  },
  async stop(ctx) {
    ctx.logger.info({ pluginId: ID }, 'observation sources stopped')
  },
}
