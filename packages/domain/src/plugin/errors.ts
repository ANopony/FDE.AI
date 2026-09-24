export class PluginError extends Error {
  readonly pluginId?: string

  constructor(message: string, pluginId?: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
    this.pluginId = pluginId
  }
}

export class DuplicatePluginError extends PluginError {}

export class PluginNotFoundError extends PluginError {}

export class InvalidLifecycleTransitionError extends PluginError {}

export class PluginRuntimeError extends PluginError {}
