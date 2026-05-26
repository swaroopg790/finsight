import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { colors, radius, shadow } from '../lib/tokens'

interface SnapshotPoint {
  date:       string
  totalValue: number
}

interface Props {
  hasHoldings: boolean
}

const PERIOD_OPTIONS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

const fmtUsd = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtDate = (d: string) => {
  const [, month, day] = d.split('-')
  return `${month}/${day}`
}

export default function PerformanceChart({ hasHoldings }: Props) {
  const [activeDays, setActiveDays] = useState(30)
  const { isMobile } = useBreakpoint()

  const { data = [], isLoading } = useQuery<SnapshotPoint[]>({
    queryKey: ['performance', activeDays],
    queryFn:  () =>
      api.get(`/portfolio/performance?days=${activeDays}`).then((r) => r.data),
    enabled:   hasHoldings,
    staleTime: 5 * 60 * 1000,
  })

  const gainAmt = data.length >= 2 ? data[data.length - 1].totalValue - data[0].totalValue : null
  const gainPct = data.length >= 2 && data[0].totalValue > 0
    ? ((data[data.length - 1].totalValue - data[0].totalValue) / data[0].totalValue) * 100
    : null

  const isPositive  = gainAmt == null || gainAmt >= 0
  const strokeColor = isPositive ? colors.brand : colors.danger

  const chartHeight  = isMobile ? 170 : 210
  const yAxisWidth   = isMobile ? 60  : 74
  const tickFontSize = isMobile ? 10  : 11

  return (
    <div style={{
      background:   colors.surface,
      borderRadius: radius.lg,
      padding:      isMobile ? 16 : 24,
      marginBottom: 16,
      border:       `1px solid ${colors.border}`,
      boxShadow:    shadow.sm,
    }}>
      {/* Header row */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        marginBottom:   16,
        gap:            8,
        flexWrap:       'wrap',
      }}>
        <div>
          <p style={{ margin: 0, color: colors.textSecondary, fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Portfolio Performance
          </p>
          {gainAmt !== null && gainPct !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {isPositive
                ? <TrendingUp size={16} color={colors.success} />
                : <TrendingDown size={16} color={colors.danger} />}
              <p style={{ margin: 0, fontSize: 13, color: isPositive ? colors.success : colors.danger, fontWeight: 600 }}>
                {gainAmt >= 0 ? '+' : ''}
                {fmtUsd(gainAmt)}&ensp;
                <span style={{ opacity: 0.85 }}>
                  ({gainAmt >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: radius.md, padding: 3 }}>
          {PERIOD_OPTIONS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setActiveDays(days)}
              style={{
                padding:      isMobile ? '5px 10px' : '5px 12px',
                borderRadius: radius.sm,
                border:       'none',
                fontSize:     12,
                fontWeight:   activeDays === days ? 600 : 400,
                cursor:       'pointer',
                background:   activeDays === days ? colors.surface : 'transparent',
                color:        activeDays === days ? colors.text    : colors.textMuted,
                boxShadow:    activeDays === days ? shadow.xs : 'none',
                minHeight:    32,
                minWidth:     isMobile ? 34 : 40,
                transition:   'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasHoldings ? (
        <p style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13, margin: '40px 0' }}>
          Connect a brokerage to see your performance chart.
        </p>
      ) : isLoading ? (
        <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: colors.textMuted, fontSize: 13 }}>Loading chart…</p>
        </div>
      ) : data.length < 2 ? (
        <div style={{
          height: chartHeight, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 8,
        }}>
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>⏳ Not enough data yet</p>
          <p style={{ color: colors.textMuted, fontSize: 12, margin: 0, textAlign: 'center' }}>
            Chart builds up over time — check back after the next sync.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            {/* SVG gradient definition */}
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: tickFontSize, fill: colors.textMuted, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              interval={isMobile ? 'preserveStartEnd' : 'preserveStart'}
            />
            <YAxis
              tickFormatter={(v) => fmtUsd(Number(v))}
              tick={{ fontSize: tickFontSize, fill: colors.textMuted, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              width={yAxisWidth}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [fmtUsd(Number(value)), 'Portfolio Value']}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => {
                const str = String(label ?? '')
                const [y, m, d] = str.split('-')
                if (!y || !m || !d) return str
                return new Date(Number(y), Number(m) - 1, Number(d))
                  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              }}
              contentStyle={{
                fontSize:     12,
                borderRadius: radius.md,
                border:       `1px solid ${colors.border}`,
                boxShadow:    shadow.md,
                fontFamily:   'inherit',
              }}
              cursor={{ stroke: strokeColor, strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke={strokeColor}
              strokeWidth={2.5}
              fill="url(#areaGradient)"
              dot={false}
              activeDot={{ r: 5, fill: strokeColor, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
