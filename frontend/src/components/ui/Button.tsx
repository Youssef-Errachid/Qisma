import type { ComponentProps } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'q-btn--primary',
  secondary: 'q-btn--secondary',
  ghost: 'q-btn--ghost',
  outline: 'q-btn--outline',
  danger: 'q-btn--danger',
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
      className={`q-btn ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}
