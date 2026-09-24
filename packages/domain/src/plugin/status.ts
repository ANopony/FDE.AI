export const PLUGIN_STATUSES = [
  'registered',
  'starting',
  'enabled',
  'stopping',
  'disabled',
  'error',
] as const

export type PluginStatus = (typeof PLUGIN_STATUSES)[number]

export function isPluginStatus(value: string): value is PluginStatus {
  return (PLUGIN_STATUSES as readonly string[]).includes(value)
}
