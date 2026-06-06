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
import { cn } from '../lib/utils'

interface DataPoint { date: string; value: number }
interface PerformanceResponse { portfolio: DataPoint[]; spy: DataPoint[]; qqq: DataPoint[] }
interface ChartRow { date: string; portfolio: number | undefined; spy: number | undefined; qqq: number | undefined }
interface Props { hasHoldings: boolean }

type Period = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y'
const PERIODS: Period[] = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y']

function periodToDays(p: Period): number {
  switch (p) {
    case '1D':  return 1
    case '5D':  return 5
    case '1M':  return 30
    case '6M':  return 180
    case 'YTD': { const now = new Date(); const jan1 = new Date(now.getFullYear(), 0, 1); return Math.max(1, Math.ceil((now.getTime() - jan1.getTime()) / 86_400_000)) }
    case '1Y':  return 365
    case '5Y':  return 1825
  }
}

const fmtUsd  = (v: number, d = 2) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtPct  = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const fmtDate = (d: string) => { const [, m, day] = d.split('-'); return `${m}/${day}` }
const fmtFullDate = (d: string) => {
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toPct(pts: DataPoint[]): DataPoint[] {
  if (pts.length === 0) return []
  const base = pts[0].value
  if (base === 0) return pts.map(p => ({ date: p.date, value: 0 }))
  return pts.map(p => ({ date: p.date, value: +((p.value / base - 1) * 100).toFixed(3) }))
}

function LegendDot({ color, label, solid }: { color: string; label: string; solid?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-7 h-0.5 shrink-0 rounded"
        style={{ background: solid ? color : 'transparent', border: solid ? 'none' : `1.5px dashed ${color}` }} />
      <span className="text-slate-500 text-xs font-medium">{label}</span>
    </div>
  )
}

export default function PerformanceChart({ hasHoldings }: Props) {
  const [activePeriod, setActivePeriod] = useState<Period>('1M')
  const activeDays = useMemo(() => periodToDays(activePeriod), [activePeriod])
  const { isMobile }    = useBreakpoint()
  const { chartColors } = useTheme()

  const { data, isLoading } = useQuery<PerformanceResponse>({
    queryKey: ['performance', activePeriod],
    queryFn:  () => api.get(`/portfolio/performance?days=${activeDays}`).then(r => r.data),
    enabled:   hasHoldings,
    staleTime: 5 * 60 * 1000,
  })

  const portfolio    = data?.portfolio ?? []
  const spy          = data?.spy       ?? []
  const qqq          = data?.qqq       ?? []
  const portfolioPct = useMemo(() => toPct(portfolio), [portfolio])
  const spyPct       = useMemo(() => toPct(spy),       [spy])
  const qqqPct       = useMemo(() => toPct(qqq),       [qqq])

  const gainAmt = portfolio.length >= 2 ? portfolio[portfolio.length - 1].value - portfolio[0].value : null
  const gainPct = portfolio.length >= 2 && portfolio[0].value > 0
    ? ((portfolio[portfolio.length - 1].value - portfolio[0].value) / portfolio[0].value) * 100 : null
  const isPositive = gainAmt == null || gainAmt >= 0

  const mergedData: ChartRow[] = useMemo(() => {
    const portfolioMap = new Map(portfolioPct.map(p => [p.date, p.value]))
    const spyMap       = new Map(spyPct.map(p => [p.date, p.value]))
    const qqqMap       = new Map(qqqPct.map(p => [p.date, p.value]))
    const allDates     = Array.from(new Set([...portfolioPct.map(p => p.date), ...spyPct.map(p => p.date), ...qqqPct.map(p => p.date)])).sort()
    if (allDates.length === 0) return []
    return allDates.map(date => ({ date, portfolio: portfolioMap.get(date), spy: spyMap.get(date), qqq: qqqMap.get(date) }))
  }, [portfolioPct, spyPct, qqqPct])

  const hasBenchmarks     = spyPct.length > 0 || qqqPct.length > 0
  const portfolioIsSparse = portfolioPct.length < 2
  const chartHeight       = isMobile ? 190 : 220
  const strokeColor       = isPositive ? chartColors.brand : chartColors.danger

  return (
    <div className="glass rounded-2xl p-4 md:p-6 mb-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="label-xs mb-1.5">Portfolio vs Benchmarks</p>
          {gainAmt !== null && gainPct !== null && (
            <div className="flex items-center gap-1.5">
              {isPositive
                ? <TrendingUp  size={15} className="text-emerald-400" />
                : <TrendingDown size={15} className="text-red-400" />}
              <span className={cn('text-sm font-semibold font-nums', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                {gainAmt >= 0 ? '+' : ''}{fmtUsd(gainAmt)}&ensp;
                <span className="opacity-80">({fmtPct(gainPct)})</span>
              </span>
            </div>
          )}
        </div>
        {/* Period selector */}
        <div className="flex gap-0.5 shrink-0">
          {PERIODS.map(period => (
            <button key={period} onClick={() => setActivePeriod(period)}
              className={cn('text-xs px-2 py-1 rounded-lg border transition-all',
                activePeriod === period
                  ? 'bg-indigo-600 border-indigo-600 text-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-300')}>
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      {hasBenchmarks && mergedData.length >= 2 && (
        <div className="flex gap-4 mb-3 flex-wrap">
          <LegendDot color={chartColors.brand} label="Portfolio"         solid />
          <LegendDot color={chartColors.spy}   label="S&P 500 (SPY)"          />
          <LegendDot color={chartColors.qqq}   label="Nasdaq-100 (QQQ)"       />
        </div>
      )}

      {/* Chart body */}
      {!hasHoldings ? (
        <p className="text-slate-500 text-center text-sm my-10">Connect a brokerage to see your performance chart.</p>
      ) : isLoading ? (
        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          <div className="skeleton h-5 w-32 rounded" />
        </div>
      ) : mergedData.length < 2 ? (
        <div className="flex flex-col items-center justify-center gap-2" style={{ height: chartHeight }}>
          <p className="text-slate-400 text-sm">⏳ Not enough data yet</p>
          <p className="text-slate-600 text-xs text-center">
            Click <strong className="text-indigo-400">Sync Now</strong> on the Transactions page to load data immediately.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={mergedData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={fmtDate}
              tick={{ fontSize: isMobile ? 10 : 11, fill: '#475569', fontFamily: 'inherit' }}
              axisLine={false} tickLine={false}
              interval={isMobile ? 'preserveStartEnd' : 'preserveStart'} />
            <YAxis
              tickFormatter={v => (Number(v) >= 0 ? '+' : '') + Number(v).toFixed(1) + '%'}
              tick={{ fontSize: isMobile ? 10 : 11, fill: '#475569', fontFamily: 'inherit' }}
              axisLine={false} tickLine={false} width={isMobile ? 60 : 68} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const labels: Record<string, string> = { portfolio: 'Portfolio', spy: 'S&P 500 (SPY)', qqq: 'Nasdaq-100 (QQQ)' }
                return [fmtPct(Number(value)), labels[String(name)] ?? String(name)]
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => fmtFullDate(String(label ?? ''))}
              contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: '#0f0f1e', fontFamily: 'inherit', color: '#e2e8f0' }}
              cursor={{ stroke: strokeColor, strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Area type="monotone" dataKey="portfolio" stroke={strokeColor} strokeWidth={2.5}
              fill="url(#areaGradient)" dot={false} activeDot={{ r: 5, fill: strokeColor, strokeWidth: 2, stroke: '#fff' }} connectNulls={false} />
            {spyPct.length > 0 && (
              <Line type="monotone" dataKey="spy" stroke={chartColors.spy} strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} activeDot={{ r: 4, fill: chartColors.spy, strokeWidth: 0 }} connectNulls={false} />
            )}
            {qqqPct.length > 0 && (
              <Line type="monotone" dataKey="qqq" stroke={chartColors.qqq} strokeWidth={1.5}
                strokeDasharray="3 3" dot={false} activeDot={{ r: 4, fill: chartColors.qqq, strokeWidth: 0 }} connectNulls={false} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {mergedData.length >= 2 && portfolioIsSparse && hasBenchmarks && (
        <p className="text-slate-600 text-xs text-center mt-3">
          ⏳ Portfolio history builds over time — benchmark lines shown for context
        </p>
      )}
    </div>
  )
}
