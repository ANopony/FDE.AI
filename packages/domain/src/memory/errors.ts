export class MemoryNotFoundError extends Error {
  readonly memoryId?: string

  constructor(message: string, memoryId?: string) {
    super(message)
    this.name = 'MemoryNotFoundError'
    this.memoryId = memoryId
  }
}
