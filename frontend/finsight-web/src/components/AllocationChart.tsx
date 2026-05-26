import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { colors, radius, shadow, CHART_COLORS } from '../lib/tokens'

interface AllocationItem {
  ticker:    string
  name:      string
  value:     number
  weightPct: number
}

interface Props {
  hasHoldings: boolean
}

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

  const chartHeight = isMobile ? 210 : 230
  const outerRadius = isMobile ? 72  : 84
  const innerRadius = isMobile ? 44  : 54
  const cyPercent   = isMobile ? '42%' : '44%'

  return (
    <div style={{
      background:   colors.surface,
      borderRadius: radius.lg,
      padding:      isMobile ? 16 : 24,
      marginBottom: 16,
      border:       `1px solid ${colors.border}`,
      boxShadow:    shadow.sm,
    }}>
      <p style={{ margin: '0 0 16px', color: colors.textSecondary, fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Asset Allocation
      </p>

      {!hasHoldings ? (
        <p style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13, margin: '40px 0' }}>
          Connect a brokerage to see your allocation.
        </p>
      ) : isLoading ? (
        <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: colors.textMuted, fontSize: 13 }}>Loading…</p>
        </div>
      ) : chartData.length === 0 ? (
        <div style={{
          height: chartHeight, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 8,
        }}>
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>⏳ No priced positions yet</p>
          <p style={{ color: colors.textMuted, fontSize: 12, margin: 0 }}>Sync prices to see your allocation.</p>
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
                fontSize:     12,
                borderRadius: radius.md,
                border:       `1px solid ${colors.border}`,
                boxShadow:    shadow.md,
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
              wrapperStyle={{ fontSize: isMobile ? 10 : 11, fontFamily: 'inherit', color: colors.textSecondary }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
