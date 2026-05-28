import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useTheme }       from '../contexts/ThemeContext'
import { colors, radius, shadow } from '../lib/tokens'

// ── API response shape ────────────────────────────────────────────────────────
interface DataPoint {
  date:  string
  value: number
}

interface PerformanceResponse {
  portfolio: DataPoint[]
  spy:       DataPoint[]
  qqq:       DataPoint[]
}

// ── Merged chart row (one entry per date) ─────────────────────────────────────
interface ChartRow {
  date:      string
  portfolio: number | undefined
  spy:       number | undefined
  qqq:       number | undefined
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

const fmtFullDate = (d: string) => {
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return new Date(Number(y), Number(m) - 1, Number(day))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PerformanceChart({ hasHoldings }: Props) {
  const [activeDays, setActiveDays] = useState(30)
  const { isMobile }    = useBreakpoint()
  const { chartColors } = useTheme()

  const { data, isLoading } = useQuery<PerformanceResponse>({
    queryKey: ['performance', activeDays],
    queryFn:  () =>
      api.get(`/portfolio/performance?days=${activeDays}`).then((r) => r.data),
    enabled:   hasHoldings,
    staleTime: 5 * 60 * 1000,
  })

  const portfolio = data?.portfolio ?? []
  const spy       = data?.spy       ?? []
  const qqq       = data?.qqq       ?? []

  // ── Compute period gain on the portfolio series ───────────────────────────
  const gainAmt = portfolio.length >= 2
    ? portfolio[portfolio.length - 1].value - portfolio[0].value
    : null
  const gainPct = portfolio.length >= 2 && portfolio[0].value > 0
    ? ((portfolio[portfolio.length - 1].value - portfolio[0].value) / portfolio[0].value) * 100
    : null

  const isPositive = gainAmt == null || gainAmt >= 0

  // ── Merge all three series into one recharts-compatible dataset ───────────
  // Key: union of all dates, each row has optional spy/qqq values
  const mergedData: ChartRow[] = (() => {
    if (portfolio.length === 0) return []

    const spyMap = new Map(spy.map((p) => [p.date, p.value]))
    const qqqMap = new Map(qqq.map((p) => [p.date, p.value]))

    return portfolio.map((p) => ({
      date:      p.date,
      portfolio: p.value,
      spy:       spyMap.get(p.date),
      qqq:       qqqMap.get(p.date),
    }))
  })()

  const hasBenchmarks = spy.length > 0 || qqq.length > 0

  const chartHeight  = isMobile ? 190 : 220
  const yAxisWidth   = isMobile ? 62  : 76
  const tickFontSize = isMobile ? 10  : 11

  // ── Portfolio gradient colour ─────────────────────────────────────────────
  const strokeColor = isPositive ? chartColors.brand : chartColors.danger

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
          <p style={{
            margin: 0, color: colors.textSecondary, fontSize: 12,
            fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Portfolio vs Benchmarks
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
                color:        activeDays === days ? colors.text     : colors.textMuted,
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

      {/* Legend (only shown when benchmarks are available) */}
      {hasBenchmarks && mergedData.length >= 2 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <LegendDot color={chartColors.brand} label="Portfolio" solid />
          <LegendDot color={chartColors.spy}   label="S&P 500 (SPY)" />
          <LegendDot color={chartColors.qqq}   label="Nasdaq-100 (QQQ)" />
        </div>
      )}

      {!hasHoldings ? (
        <p style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13, margin: '40px 0' }}>
          Connect a brokerage to see your performance chart.
        </p>
      ) : isLoading ? (
        <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: colors.textMuted, fontSize: 13 }}>Loading chart…</p>
        </div>
      ) : mergedData.length < 2 ? (
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
          <AreaChart data={mergedData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            {/* SVG gradient for portfolio area fill */}
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.15} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: tickFontSize, fill: chartColors.axis, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              interval={isMobile ? 'preserveStartEnd' : 'preserveStart'}
            />
            <YAxis
              tickFormatter={(v) => fmtUsd(Number(v))}
              tick={{ fontSize: tickFontSize, fill: chartColors.axis, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              width={yAxisWidth}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const labels: Record<string, string> = {
                  portfolio: 'Portfolio',
                  spy:       'S&P 500 (SPY)',
                  qqq:       'Nasdaq-100 (QQQ)',
                }
                return [fmtUsd(Number(value)), labels[String(name)] ?? String(name)]
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => fmtFullDate(String(label ?? ''))}
              contentStyle={{
                fontSize:     12,
                borderRadius: radius.md,
                border:       `1px solid ${colors.border}`,
                boxShadow:    shadow.md,
                fontFamily:   'inherit',
                background:   colors.surface,
                color:        colors.text,
              }}
              cursor={{ stroke: strokeColor, strokeWidth: 1, strokeDasharray: '4 2' }}
            />

            {/* Portfolio area (filled) */}
            <Area
              type="monotone"
              dataKey="portfolio"
              stroke={strokeColor}
              strokeWidth={2.5}
              fill="url(#areaGradient)"
              dot={false}
              activeDot={{ r: 5, fill: strokeColor, strokeWidth: 2, stroke: '#fff' }}
            />

            {/* SPY benchmark line */}
            {spy.length > 0 && (
              <Line
                type="monotone"
                dataKey="spy"
                stroke={chartColors.spy}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 4, fill: chartColors.spy, strokeWidth: 0 }}
              />
            )}

            {/* QQQ benchmark line */}
            {qqq.length > 0 && (
              <Line
                type="monotone"
                dataKey="qqq"
                stroke={chartColors.qqq}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                activeDot={{ r: 4, fill: chartColors.qqq, strokeWidth: 0 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Small legend dot component ────────────────────────────────────────────────
function LegendDot({ color, label, solid }: { color: string; label: string; solid?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width:      28,
        height:     2,
        background: solid ? color : 'transparent',
        border:     solid ? 'none' : `1.5px dashed ${color}`,
        borderRadius: 1,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 500 }}>
        {label}
      </span>
    </div>
  )
}
