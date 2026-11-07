import type { ReactNode } from 'react'

type Tone = 'neutral' | 'brand' | 'warning'

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-credit-soft text-credit ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  )
}
