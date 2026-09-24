export class ObservationNotFoundError extends Error {
  readonly observationId?: string

  constructor(message: string, observationId?: string) {
    super(message)
    this.name = 'ObservationNotFoundError'
    this.observationId = observationId
  }
}
