import type { Observation, ObservationPage, ObservationQueryNormalized } from './observation.js'

/** Persistence boundary for Observations; the Drizzle implementation lives in @fde-ai/database. */
export interface ObservationStore {
  insert(observation: Observation): Promise<void>
  get(id: string): Promise<Observation | undefined>
  list(query: ObservationQueryNormalized): Promise<ObservationPage>
}
