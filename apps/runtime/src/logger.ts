import { pino } from 'pino'
import type { Logger } from '@fde-ai/domain'

export function createLogger(name = 'fde-runtime'): Logger {
  return pino({ name, level: process.env.LOG_LEVEL ?? 'info' })
}
