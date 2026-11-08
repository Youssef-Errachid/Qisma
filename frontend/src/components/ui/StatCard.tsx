import type { ReactNode } from 'react'

/** One figure with its label, for a <dl>. */
export function StatCard({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-200 sm:p-5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere] sm:text-2xl">{children}</dd>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
