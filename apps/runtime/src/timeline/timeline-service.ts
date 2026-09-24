import { TimelineQuerySchema } from '@fde-ai/domain'
import type {
  Logger,
  MemoryStore,
  Observation,
  ObservationStore,
  TimelineItem,
  TimelineMemoryChange,
  TimelinePage,
  TimelineQuery,
  TimelineService,
} from '@fde-ai/domain'

export interface TimelineServiceOptions {
  observationStore: ObservationStore
  memoryStore: MemoryStore
  logger: Logger
}

interface DecodedCursor {
  obs?: number
  rev?: number
}

const CURSOR_RE = /^o=(\d+|-);r=(\d+|-)$/

/**
 * Merges observations and memory changes into one newest-first timeline.
 * Pagination advances each source by how many of its items were actually
 * consumed, so no item is ever skipped or duplicated.
 */
export class DefaultTimelineService implements TimelineService {
  constructor(private readonly options: TimelineServiceOptions) {}

  async query(query: TimelineQuery): Promise<TimelinePage> {
    const parsed = TimelineQuerySchema.parse(query)
    const cursor = decodeCursor(parsed.cursor)
    const { limit, kind, pluginId, sourceId, memoryId, from, to } = parsed

    // Source-specific filters exclude the other source: a plugin/source filter
    // only matches observations, a memory filter only matches memory changes.
    const includeObservations = kind !== 'memory_change' && !memoryId
    const includeMemoryChanges = kind !== 'observation' && !pluginId && !sourceId

    const obsItems: TimelineItem[] = []
    let obsFetched = 0
    let obsBeyondBatch = false
    if (includeObservations) {
      const page = await this.options.observationStore.list({
        pluginId,
        sourceId,
        from,
        to,
        limit,
        cursor: cursor.obs !== undefined ? String(cursor.obs) : undefined,
      })
      obsItems.push(...page.items.map(observationToItem))
      obsFetched = page.items.length
      obsBeyondBatch = page.nextCursor !== undefined
    }

    const revItems: TimelineItem[] = []
    let revFetched = 0
    let revBeyondBatch = false
    if (includeMemoryChanges) {
      const page = await this.options.memoryStore.listRevisionsFiltered({
        memoryId,
        from,
        to,
        limit,
        cursor: cursor.rev !== undefined ? String(cursor.rev) : undefined,
      })
      revItems.push(...page.items.map(changeToItem))
      revFetched = page.items.length
      revBeyondBatch = page.nextCursor !== undefined
    }

    const merged = [...obsItems, ...revItems].sort(byTimestampDesc)
    const pageItems = merged.slice(0, limit)
    const consumedObs = pageItems.filter((item) => item.kind === 'observation').length
    const consumedRev = pageItems.length - consumedObs

    // A further page exists only while a source still holds unconsumed items
    // from this batch, or reported more rows beyond it.
    const moreObservations = obsFetched > consumedObs || obsBeyondBatch
    const moreMemoryChanges = revFetched > consumedRev || revBeyondBatch

    const nextCursor =
      pageItems.length === 0 || (!moreObservations && !moreMemoryChanges)
        ? undefined
        : encodeCursor(nextOffset(cursor.obs, consumedObs), nextOffset(cursor.rev, consumedRev))

    this.options.logger.debug({ count: pageItems.length, cursor: parsed.cursor ?? 'none' }, 'timeline page served')
    return { items: pageItems, nextCursor }
  }
}

/** Advances a source offset by its consumed count; 0 means retry same offset. */
function nextOffset(base: number | undefined, consumed: number): number | undefined {
  if (consumed === 0) return base ?? 0
  return (base ?? 0) + consumed
}

function decodeCursor(cursor: string | undefined): DecodedCursor {
  if (!cursor) return {}
  const match = CURSOR_RE.exec(cursor)
  if (!match) return {}
  const out: DecodedCursor = {}
  if (match[1] !== '-') out.obs = Number(match[1])
  if (match[2] !== '-') out.rev = Number(match[2])
  return out
}

function encodeCursor(obs: number | undefined, rev: number | undefined): string {
  return `o=${obs ?? '-'};r=${rev ?? '-'}`
}

/** Newest first; same-timestamp items order effect-first so derivations read naturally. */
const KIND_ORDER: Record<TimelineItem['kind'], number> = {
  memory_change: 0,
  agent_event: 1,
  observation: 2,
}

function byTimestampDesc(a: TimelineItem, b: TimelineItem): number {
  const byTime = b.timestamp.localeCompare(a.timestamp)
  if (byTime !== 0) return byTime
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  return byKind !== 0 ? byKind : a.id.localeCompare(b.id)
}

function summarize(payload: unknown): string {
  try {
    const text = JSON.stringify(payload)
    return text.length > 120 ? `${text.slice(0, 120)}…` : text
  } catch {
    return String(payload).slice(0, 120)
  }
}

function observationToItem(observation: Observation): TimelineItem {
  return {
    id: observation.id,
    kind: 'observation',
    timestamp: observation.timestamp,
    source: observation.sourceId,
    pluginId: observation.pluginId,
    title: observation.type,
    summary: summarize(observation.payload),
    relatedIds: [],
    detailRef: `/api/observations/${observation.id}`,
  }
}

function changeToItem(change: TimelineMemoryChange): TimelineItem {
  const { revision, memoryType } = change
  const action = revision.before === null ? 'created' : revision.after === null ? 'deleted' : 'updated'
  return {
    id: revision.id,
    kind: 'memory_change',
    timestamp: revision.timestamp,
    source: revision.memoryId,
    title: `${memoryType} memory ${action}`,
    summary: revision.reason,
    relatedIds: [revision.memoryId, ...revision.sourceEventIds],
    detailRef: `/api/memories/${revision.memoryId}/revisions`,
  }
}
