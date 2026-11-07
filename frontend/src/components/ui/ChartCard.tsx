import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  description?: string
  /** The same data as the chart, as a table for screen readers (a picture alone tells them nothing). */
  columns: string[]
  rows: string[][]
  children: ReactNode
}

export function ChartCard({ title, description, columns, rows, children }: ChartCardProps) {
  return (
    <figure className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <figcaption className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </figcaption>
      <div aria-hidden="true">{children}</div>
      {/* hidden from the eye, read by screen readers. The box is hidden, not the table: a hidden <table> still shows its <caption> */}
      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  )
}
