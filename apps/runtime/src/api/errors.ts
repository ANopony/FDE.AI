import {
  InvalidLifecycleTransitionError,
  MemoryNotFoundError,
  ObservationNotFoundError,
  PluginNotFoundError,
  PluginRuntimeError,
} from '@fde-ai/domain'
import { ZodError } from 'zod'

export interface ApiErrorShape {
  statusCode: number
  message: string
}

/** Maps domain errors to HTTP semantics: 404 / 409 / 500 / 400 (validation). */
export function mapDomainError(error: unknown): ApiErrorShape {
  if (error instanceof PluginNotFoundError || error instanceof MemoryNotFoundError || error instanceof ObservationNotFoundError) {
    return { statusCode: 404, message: error.message }
  }
  if (error instanceof InvalidLifecycleTransitionError) {
    return { statusCode: 409, message: error.message }
  }
  if (error instanceof PluginRuntimeError) {
    return { statusCode: 500, message: error.message }
  }
  if (error instanceof ZodError) {
    return { statusCode: 400, message: `validation failed: ${error.message}` }
  }
  return { statusCode: 500, message: error instanceof Error ? error.message : 'internal error' }
}
