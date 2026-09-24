'use client'

import { useParams } from 'next/navigation'
import { MemoryDetailView } from '@/components/memory/memory-detail-view'

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>()
  return <MemoryDetailView id={decodeURIComponent(params.id)} />
}
