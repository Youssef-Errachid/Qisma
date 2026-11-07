import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { type ContributionDatum, compactAmount, tooltipAmount } from '../chartData'
import { GRID_COLOR, PAID_COLOR, SHARE_COLOR } from './colors'

interface Props {
  data: ContributionDatum[]
  currency: string
  language: string
  paidLabel: string
  shareLabel: string
}

export default function ContributionsChart({ data, currency, language, paidLabel, shareLabel }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260} initialDimension={{ width: 640, height: 260 }}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={(v: number) => compactAmount(v, language)} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          formatter={(_value, name, item) => {
            const row = item.payload as ContributionDatum
            return tooltipAmount(name === paidLabel ? row.paidMinor : row.shareMinor, currency, language)
          }}
        />
        <Legend iconType="circle" />
        <Bar name={paidLabel} dataKey="paid" fill={PAID_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar name={shareLabel} dataKey="share" fill={SHARE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
