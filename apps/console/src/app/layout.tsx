import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { NavLinks } from '@/components/nav-links'
import './globals.css'

export const metadata: Metadata = {
  title: 'FDE.AI Console',
  description: 'Phase 1 Runtime & Observability console',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white px-4 py-6">
            <div className="mb-6 px-2 text-lg font-semibold">FDE.AI Console</div>
            <NavLinks />
          </aside>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  )
}
