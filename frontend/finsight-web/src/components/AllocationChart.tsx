import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface AllocationItem {
  ticker:    string
  name:      string
  value:     number
  weightPct: number
}

interface Props {
  hasHoldings: boolean
}

const COLORS = [
  '#1a1a1a', '#4f46e5', '#0891b2', '#16a34a', '#d97706',
  '#dc2626', '#7c3aed', '#0f766e', '#c2410c', '#1d4ed8',
]

const fmtUsd = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AllocationChart({ hasHoldings }: Props) {
  const { isMobile } = useBreakpoint()

  const { data = [], isLoading } = useQuery<AllocationItem[]>({
    queryKey: ['allocation'],
    queryFn:  () => api.get('/portfolio/allocation').then((r) => r.data),
    enabled:   hasHoldings,
    staleTime: 5 * 60 * 1000,
  })

  const MAX_SLICES = isMobile ? 6 : 8
  let chartData = data
  if (data.length > MAX_SLICES) {
    const top  = data.slice(0, MAX_SLICES - 1)
    const rest = data.slice(MAX_SLICES - 1)
    chartData  = [
      ...top,
      {
        ticker:    'OTHER',
        name:      'Other',
        value:     rest.reduce((s, d) => s + d.value, 0),
        weightPct: rest.reduce((s, d) => s + d.weightPct, 0),
      },
    ]
  }

  const chartHeight  = isMobile ? 200 : 220
  const outerRadius  = isMobile ? 68  : 80
  const innerRadius  = isMobile ? 42  : 52
  const cyPercent    = isMobile ? '42%' : '45%'

  return (
    <div style={{
      background:   '#f5f5f5',
      borderRadius: 12,
      padding:      isMobile ? 16 : 24,
      marginBottom: 16,
    }}>
      <p style={{ margin: '0 0 16px', color: '#666', fontSize: 13 }}>Asset Allocation</p>

      {!hasHoldings ? (
        <p style={{ color: '#bbb', textAlign: 'center', fontSize: 13, margin: '32px 0' }}>
          Connect a brokerage to see your allocation.
        </p>
      ) : isLoading ? (
        <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#bbb', fontSize: 13 }}>Loading…</p>
        </div>
      ) : chartData.length === 0 ? (
        <div style={{
          height: chartHeight, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 8,
        }}>
          <p style={{ color: '#888', fontSize: 13, margin: 0 }}>⏳ No priced positions yet</p>
          <p style={{ color: '#bbb', fontSize: 12, margin: 0 }}>Sync prices to see your allocation.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy={cyPercent}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, _name: any, entry: any) => {
                const item = entry?.payload as AllocationItem | undefined
                return [`${fmtUsd(Number(value))} (${item?.weightPct.toFixed(1) ?? ''}%)`, item?.ticker ?? '']
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
            />
            <Legend
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(_value: any, entry: any) => {
                const item = entry?.payload as AllocationItem | undefined
                return `${item?.ticker ?? _value}  ${item?.weightPct.toFixed(1) ?? ''}%`
              }}
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: isMobile ? 10 : 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
