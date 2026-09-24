import { Suspense } from 'react'
import { TimelineView } from '@/components/timeline/timeline-view'

export default function TimelinePage() {
  // useSearchParams (for ?event= / ?memoryId= deep links) needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading timeline…</p>}>
      <TimelineView />
    </Suspense>
  )
}
