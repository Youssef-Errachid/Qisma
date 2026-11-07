import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { type CategoryDatum, tooltipAmount } from '../chartData'
import { CATEGORY_COLORS } from './colors'

interface Props {
  data: CategoryDatum[]
  currency: string
  language: string
}

export default function CategoryChart({ data, currency, language }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="h-56 w-full sm:w-56 sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 224, height: 224 }}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={95} paddingAngle={2} stroke="none">
              {data.map((entry) => (
                <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip formatter={(_value, _name, item) => tooltipAmount((item.payload as CategoryDatum).minor, currency, language)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((entry) => (
          <li key={entry.category} className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[entry.category] ?? '#94a3b8' }} />
            <span className="flex-1 text-slate-700">{entry.label}</span>
            <span className="tabular-nums text-slate-500">{entry.percent}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
