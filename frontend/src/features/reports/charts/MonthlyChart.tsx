import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { type MonthDatum, compactAmount, tooltipAmount } from '../chartData'
import { GRID_COLOR, PAID_COLOR } from './colors'

interface Props {
  data: MonthDatum[]
  currency: string
  language: string
}

export default function MonthlyChart({ data, currency, language }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260} initialDimension={{ width: 640, height: 260 }}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={(v: number) => compactAmount(v, language)} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          formatter={(_value, _name, item) => tooltipAmount((item.payload as MonthDatum).minor, currency, language)}
          labelFormatter={(label) => String(label)}
        />
        <Bar dataKey="value" fill={PAID_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}
