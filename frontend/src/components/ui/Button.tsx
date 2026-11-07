import type { ComponentProps } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  /** Shows a spinner and blocks further clicks, so a slow request cannot be submitted twice. */
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong focus-visible:outline-brand',
  secondary: 'bg-white text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-500',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-500',
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}
