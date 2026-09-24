import type { PluginStatus } from '@fde-ai/api-client'
import { Badge } from '@/components/ui/badge'

const STYLES: Record<PluginStatus, string> = {
  registered: 'bg-zinc-100 text-zinc-600',
  starting: 'bg-amber-100 text-amber-700',
  stopping: 'bg-amber-100 text-amber-700',
  enabled: 'bg-emerald-100 text-emerald-700',
  disabled: 'bg-zinc-100 text-zinc-500',
  error: 'bg-red-100 text-red-700',
}

export function PluginStatusBadge({ status }: { status: PluginStatus }) {
  return <Badge className={STYLES[status]}>{status}</Badge>
}
