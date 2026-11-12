import type { ReactNode } from 'react'

type Tone = 'mint' | 'peach' | 'plain'

const TONES: Record<Tone, string> = {
  mint: 'q-stat--mint',
  peach: 'q-stat--peach',
  plain: 'q-stat--plain',
}

const ICON_COLOR: Record<Tone, string> = {
  mint: 'var(--brand-600)',
  peach: 'var(--owe)',
  plain: 'var(--brand-600)',
}

interface StatCardProps {
  label: string
  children: ReactNode
  hint?: string
  tone?: Tone
  icon?: ReactNode
}

export function StatCard({ label, children, hint, tone = 'plain', icon }: StatCardProps) {
  return (
    <div className={`q-stat ${TONES[tone]}`}>
      {icon && (
        <span style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--surface)', color: ICON_COLOR[tone], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </span>
      )}
      <dd className="q-amount" style={{ fontSize: 28, lineHeight: 1.1 }}>{children}</dd>
      <dt className="q-label">{label}</dt>
      {hint && <p className="q-label" style={{ marginTop: 4 }}>{hint}</p>}
    </div>
  )
}
