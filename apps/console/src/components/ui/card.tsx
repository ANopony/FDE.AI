import type { ReactNode } from 'react'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-lg border border-zinc-200 bg-white shadow-sm ${className}`}>{children}</div>
}

export function CardHeader({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold">{children}</h2>
}

export function CardContent({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}
