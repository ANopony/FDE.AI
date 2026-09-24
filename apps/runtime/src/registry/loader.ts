import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateManifest } from '@fde-ai/domain'
import type { ConfigService, Logger, Plugin } from '@fde-ai/domain'
import { readListConfig } from '../config.js'

export interface LoaderOptions {
  config: ConfigService
  logger: Logger
}

/**
 * File path entries in config are resolved against the process working
 * directory (a bare dynamic import would resolve them against this module);
 * package specifiers and URLs are passed through untouched.
 */
export function toImportSpecifier(specifier: string): string {
  if (specifier.startsWith('file:') || specifier.startsWith('node:')) return specifier
  const looksLikePath =
    specifier.startsWith('.') || isAbsolute(specifier) || /^[a-zA-Z]:[\\/]/.test(specifier)
  return looksLikePath ? pathToFileURL(resolve(specifier)).href : specifier
}

/**
 * Dynamically imports a module exporting a Plugin as a named `plugin` export
 * or as the default export. The manifest is validated at load time.
 */
export async function loadPluginModule(specifier: string, options: LoaderOptions): Promise<Plugin> {
  const target = toImportSpecifier(specifier)
  const mod = (await import(target)) as { default?: unknown; plugin?: unknown }
  const candidate = (mod.default ?? mod.plugin) as Partial<Plugin> | undefined
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`Plugin module does not export a plugin: ${specifier}`)
  }
  const manifest = validateManifest(candidate.manifest)
  options.logger.info({ pluginId: manifest.id, specifier }, 'plugin module loaded')
  return candidate as Plugin
}

/** Loads every plugin listed in config key `plugin.entries` (comma-separated or array). */
export async function loadConfiguredPlugins(options: LoaderOptions): Promise<Plugin[]> {
  const plugins: Plugin[] = []
  for (const entry of readListConfig(options.config, 'plugin.entries')) {
    plugins.push(await loadPluginModule(entry, options))
  }
  return plugins
}
