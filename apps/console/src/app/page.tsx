import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PLACEHOLDERS = [
  {
    href: '/plugins',
    title: 'Plugins',
    text: 'Manage plugins, capabilities and runtime status.',
    ready: true,
  },
  { href: '/memory', title: 'Memory', text: 'Inspect memories and their revision history.', ready: false },
  { href: '/timeline', title: 'Timeline', text: 'Follow the observation → memory evidence chain.', ready: false },
] as const

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600">
            FDE.AI Phase 1 Runtime &amp; Observability console. Track what plugins observed, what the agent
            remembered, and why — all from one traceable timeline.
          </p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLACEHOLDERS.map((item) => (
          <Card key={item.href}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-zinc-600">{item.text}</p>
              <Link href={item.href} className="text-sm text-blue-700 hover:underline">
                {item.ready ? 'Open' : 'Coming soon'} →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
