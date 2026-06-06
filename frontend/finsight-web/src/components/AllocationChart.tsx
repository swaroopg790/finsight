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

interface Props { hasHoldings: boolean }

const CHART_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#f97316','#ec4899']

const fmtUsd = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AllocationChart({ hasHoldings }: Props) {
  const { isMobile } = useBreakpoint()

  const { data = [], isLoading } = useQuery<AllocationItem[]>({
    queryKey: ['allocation'],
    queryFn:  () => api.get('/portfolio/allocation').then(r => r.data),
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
      { ticker: 'OTHER', name: 'Other', value: rest.reduce((s, d) => s + d.value, 0), weightPct: rest.reduce((s, d) => s + d.weightPct, 0) },
    ]
  }

  const chartHeight = isMobile ? 210 : 230
  const outerRadius = isMobile ? 72  : 84
  const innerRadius = isMobile ? 44  : 54

  return (
    <div className="glass rounded-2xl p-4 md:p-6 mb-4">
      <p className="label-xs mb-4">Asset Allocation</p>

      {!hasHoldings ? (
        <p className="text-slate-500 text-center text-sm my-10">
          Connect a brokerage to see your allocation.
        </p>
      ) : isLoading ? (
        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          <div className="skeleton w-32 h-5 rounded" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2" style={{ height: chartHeight }}>
          <p className="text-slate-400 text-sm">⏳ No priced positions yet</p>
          <p className="text-slate-600 text-xs">Sync prices to see your allocation.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="44%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, _name: any, entry: any) => {
                const item = entry?.payload as AllocationItem | undefined
                return [`${fmtUsd(Number(value))} (${item?.weightPct.toFixed(1) ?? ''}%)`, item?.ticker ?? '']
              }}
              contentStyle={{
                background:   '#0f0f1e',
                border:       '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                fontSize:     12,
                fontFamily:   'inherit',
              }}
            />
            <Legend
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(_value: any, entry: any) => {
                const item = entry?.payload as AllocationItem | undefined
                return `${item?.ticker ?? _value}  ${item?.weightPct.toFixed(1) ?? ''}%`
              }}
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: isMobile ? 10 : 11, fontFamily: 'inherit', color: '#64748b' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
