import type { ReactNode } from 'react'

interface AlertProps {
  variant: 'error' | 'success'
  children: ReactNode
}

export function Alert({ variant, children }: AlertProps) {
  const styles =
    variant === 'error'
      ? 'bg-debt-soft text-debt ring-rose-200'
      : 'bg-credit-soft text-credit ring-emerald-200'
  return (
    // errors interrupt a screen reader, confirmations wait politely
    <div role={variant === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${styles}`}>
      {children}
    </div>
  )
}
