import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
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

// ── Merged chart row (one entry per date, all values in % change) ─────────────
interface ChartRow {
  date:      string
  portfolio: number | undefined
  spy:       number | undefined
  qqq:       number | undefined
}

interface Props {
  hasHoldings: boolean
}

// ── Period options ────────────────────────────────────────────────────────────
type Period = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y'
const PERIODS: Period[] = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y']

function periodToDays(p: Period): number {
  switch (p) {
    case '1D':  return 1
    case '5D':  return 5
    case '1M':  return 30
    case '6M':  return 180
    case 'YTD': {
      const now  = new Date()
      const jan1 = new Date(now.getFullYear(), 0, 1)
      return Math.max(1, Math.ceil((now.getTime() - jan1.getTime()) / 86_400_000))
    }
    case '1Y':  return 365
    case '5Y':  return 1825
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtUsd = (v: number, decimals = 2) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const fmtPct = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

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

/**
 * Convert a series to % change from its first value.
 * Both raw portfolio snapshots and normalised benchmark closes work correctly —
 * the normalisation factor cancels in the % calculation.
 */
function toPct(pts: DataPoint[]): DataPoint[] {
  if (pts.length === 0) return []
  const base = pts[0].value
  if (base === 0) return pts.map((p) => ({ date: p.date, value: 0 }))
  return pts.map((p) => ({ date: p.date, value: +((p.value / base - 1) * 100).toFixed(3) }))
}

export default function PerformanceChart({ hasHoldings }: Props) {
  const [activePeriod, setActivePeriod] = useState<Period>('1M')
  const activeDays = useMemo(() => periodToDays(activePeriod), [activePeriod])

  const { isMobile }    = useBreakpoint()
  const { chartColors } = useTheme()

  const { data, isLoading } = useQuery<PerformanceResponse>({
    queryKey: ['performance', activePeriod],
    queryFn:  () =>
      api.get(`/portfolio/performance?days=${activeDays}`).then((r) => r.data),
    enabled:   hasHoldings,
    staleTime: 5 * 60 * 1000,
  })

  const portfolio = data?.portfolio ?? []
  const spy       = data?.spy       ?? []
  const qqq       = data?.qqq       ?? []

  // ── Convert all series to % change from their first value ─────────────────
  const portfolioPct = useMemo(() => toPct(portfolio), [portfolio])
  const spyPct       = useMemo(() => toPct(spy),       [spy])
  const qqqPct       = useMemo(() => toPct(qqq),       [qqq])

  // ── Portfolio $ gain/loss for the header (raw dollar values) ─────────────
  const gainAmt = portfolio.length >= 2
    ? portfolio[portfolio.length - 1].value - portfolio[0].value
    : null
  const gainPct = portfolio.length >= 2 && portfolio[0].value > 0
    ? ((portfolio[portfolio.length - 1].value - portfolio[0].value) / portfolio[0].value) * 100
    : null

  const isPositive = gainAmt == null || gainAmt >= 0

  // ── Merge all three % series into a union-of-dates dataset ───────────────
  // Union approach: benchmark lines (90+ days) render even when portfolio
  // has only 1 historical snapshot right after initial brokerage connection.
  const mergedData: ChartRow[] = useMemo(() => {
    const portfolioMap = new Map(portfolioPct.map((p) => [p.date, p.value]))
    const spyMap       = new Map(spyPct.map((p) => [p.date, p.value]))
    const qqqMap       = new Map(qqqPct.map((p) => [p.date, p.value]))

    const allDates = Array.from(new Set([
      ...portfolioPct.map((p) => p.date),
      ...spyPct.map((p) => p.date),
      ...qqqPct.map((p) => p.date),
    ])).sort()

    if (allDates.length === 0) return []

    return allDates.map((date) => ({
      date,
      portfolio: portfolioMap.get(date),
      spy:       spyMap.get(date),
      qqq:       qqqMap.get(date),
    }))
  }, [portfolioPct, spyPct, qqqPct])

  const hasBenchmarks     = spyPct.length > 0 || qqqPct.length > 0
  const portfolioIsSparse = portfolioPct.length < 2

  const chartHeight  = isMobile ? 190 : 220
  const yAxisWidth   = isMobile ? 60  : 68
  const tickFontSize = isMobile ? 10  : 11

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

      {/* ── Header ──────────────────────────────────────────────────────── */}
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
                ? <TrendingUp  size={16} color={colors.success} />
                : <TrendingDown size={16} color={colors.danger}  />}
              <p style={{ margin: 0, fontSize: 13, color: isPositive ? colors.success : colors.danger, fontWeight: 600 }}>
                {gainAmt >= 0 ? '+' : ''}{fmtUsd(gainAmt)}&ensp;
                <span style={{ opacity: 0.85 }}>({fmtPct(gainPct)})</span>
              </p>
            </div>
          )}
        </div>

        {/* Period selector — Yahoo Finance style */}
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              style={{
                padding:       isMobile ? '4px 7px' : '5px 10px',
                borderRadius:  radius.sm,
                border:        'none',
                fontSize:      isMobile ? 11 : 12,
                fontWeight:    activePeriod === period ? 700 : 500,
                cursor:        'pointer',
                background:    activePeriod === period ? colors.brand : 'transparent',
                color:         activePeriod === period ? '#fff' : colors.textMuted,
                transition:    'all 0.15s',
                minHeight:     28,
                minWidth:      isMobile ? 28 : 34,
                letterSpacing: '0.3px',
              }}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      {hasBenchmarks && mergedData.length >= 2 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <LegendDot color={chartColors.brand} label="Portfolio"          solid />
          <LegendDot color={chartColors.spy}   label="S&P 500 (SPY)"             />
          <LegendDot color={chartColors.qqq}   label="Nasdaq-100 (QQQ)"          />
        </div>
      )}

      {/* ── Chart body ──────────────────────────────────────────────────── */}
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
            Click <strong style={{ color: colors.brand }}>Sync Now</strong> on the Transactions
            page to load data immediately.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={mergedData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />

            {/* 0 % reference line — anchors "break-even" visually */}
            <ReferenceLine
              y={0}
              stroke={chartColors.axis}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />

            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: tickFontSize, fill: chartColors.axis, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              interval={isMobile ? 'preserveStartEnd' : 'preserveStart'}
            />
            <YAxis
              tickFormatter={(v) => {
                const n = Number(v)
                return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
              }}
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
                return [fmtPct(Number(value)), labels[String(name)] ?? String(name)]
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

            {/* Portfolio — filled area */}
            <Area
              type="monotone"
              dataKey="portfolio"
              stroke={strokeColor}
              strokeWidth={2.5}
              fill="url(#areaGradient)"
              dot={false}
              activeDot={{ r: 5, fill: strokeColor, strokeWidth: 2, stroke: '#fff' }}
              connectNulls={false}
            />

            {/* SPY benchmark line */}
            {spyPct.length > 0 && (
              <Line
                type="monotone"
                dataKey="spy"
                stroke={chartColors.spy}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 4, fill: chartColors.spy, strokeWidth: 0 }}
                connectNulls={false}
              />
            )}

            {/* QQQ benchmark line */}
            {qqqPct.length > 0 && (
              <Line
                type="monotone"
                dataKey="qqq"
                stroke={chartColors.qqq}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                activeDot={{ r: 4, fill: chartColors.qqq, strokeWidth: 0 }}
                connectNulls={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Sparse portfolio notice */}
      {mergedData.length >= 2 && portfolioIsSparse && hasBenchmarks && (
        <p style={{
          margin: '10px 0 0', fontSize: 11,
          color: colors.textMuted, textAlign: 'center',
        }}>
          ⏳ Portfolio history builds over time — benchmark lines shown for context
        </p>
      )}
    </div>
  )
}

// ── Small legend dot component ────────────────────────────────────────────────
function LegendDot({ color, label, solid }: { color: string; label: string; solid?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width:        28,
        height:       2,
        background:   solid ? color : 'transparent',
        border:       solid ? 'none' : `1.5px dashed ${color}`,
        borderRadius: 1,
        flexShrink:   0,
      }} />
      <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 500 }}>
        {label}
      </span>
    </div>
  )
}
