import type { ReactNode } from 'react'

type Tone = 'neutral' | 'brand' | 'warning' | 'active' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'q-badge--archived',
  brand: 'q-badge--owner',
  warning: 'q-badge--pending',
  active: 'q-badge--active',
  danger: 'q-badge--danger',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`q-badge ${TONES[tone]}`}>
      {children}
    </span>
  )
}
