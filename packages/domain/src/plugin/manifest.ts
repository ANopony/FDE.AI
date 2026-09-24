import { z } from 'zod'

/** Capability declarations in a Plugin manifest. */
export const PluginCapabilitiesSchema = z.object({
  services: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  observationSources: z.array(z.string()).optional(),
  memoryHandlers: z.array(z.string()).optional(),
})

export type PluginCapabilities = z.infer<typeof PluginCapabilitiesSchema>

/**
 * Phase 1 minimal manifest. Unknown fields (e.g. author, config) are kept
 * for forward compatibility instead of being rejected.
 */
export const PluginManifestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional(),
    capabilities: PluginCapabilitiesSchema.optional(),
  })
  .passthrough()

export type PluginManifest = z.infer<typeof PluginManifestSchema>

export function validateManifest(input: unknown): PluginManifest {
  return PluginManifestSchema.parse(input)
}
