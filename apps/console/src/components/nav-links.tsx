'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/plugins', label: 'Plugins' },
  { href: '/memory', label: 'Memory' },
  { href: '/timeline', label: 'Timeline' },
] as const

export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-2 py-1.5 text-sm ${
              active ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
