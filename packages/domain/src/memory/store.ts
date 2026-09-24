import type { Memory, MemoryPage, MemoryQueryNormalized, MemoryRevision, MemoryRevisionQueryNormalized } from './memory.js'
import type { TimelineMemoryChangePage } from '../timeline/timeline.js'

/**
 * Persistence boundary for Memories and their Revisions. Mutations are
 * paired operations so implementations can keep them atomic (transactions);
 * the Drizzle implementation lives in @fde-ai/database.
 */
export interface MemoryStore {
  createWithRevision(memory: Memory, revision: MemoryRevision): Promise<void>
  updateWithRevision(memory: Memory, revision: MemoryRevision): Promise<void>
  deleteWithRevision(id: string, deletedAt: string, revision: MemoryRevision): Promise<void>
  get(id: string): Promise<Memory | undefined>
  list(query: MemoryQueryNormalized): Promise<MemoryPage>
  listRevisions(memoryId: string): Promise<MemoryRevision[]>
  /** Timeline-oriented revision view (memory type joined), newest first. */
  listRevisionsFiltered(query: MemoryRevisionQueryNormalized): Promise<TimelineMemoryChangePage>
  /** True when the memory exists, including deleted ones (audit trail). */
  exists(id: string): Promise<boolean>
}
