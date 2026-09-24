import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  default: 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100',
  primary: 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800',
  danger: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
}

export function Button({ variant = 'default', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
