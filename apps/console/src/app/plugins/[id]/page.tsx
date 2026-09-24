'use client'

import { useParams } from 'next/navigation'
import { PluginDetailView } from '@/components/plugin/plugin-detail-view'

export default function PluginDetailPage() {
  const params = useParams<{ id: string }>()
  return <PluginDetailView id={decodeURIComponent(params.id)} />
}
