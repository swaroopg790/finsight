import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'

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

  const chartHeight  = isMobile ? 160 : 200
  const yAxisWidth   = isMobile ? 56  : 72
  const tickFontSize = isMobile ? 10  : 11

  return (
    <div style={{ background: '#f5f5f5', borderRadius: 12, padding: isMobile ? 16 : 24, marginBottom: 16 }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'flex-start',
        marginBottom: 16,
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>Portfolio Performance</p>
          {gainAmt !== null && gainPct !== null && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: gainAmt >= 0 ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
              {gainAmt >= 0 ? '+' : ''}{fmtUsd(gainAmt)} ({gainAmt >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
            </p>
          )}
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIOD_OPTIONS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setActiveDays(days)}
              style={{
                padding:      isMobile ? '5px 8px' : '4px 10px',
                borderRadius: 6,
                border:       'none',
                fontSize:     isMobile ? 11 : 12,
                cursor:       'pointer',
                background:   activeDays === days ? '#1a1a1a' : '#e5e5e5',
                color:        activeDays === days ? '#fff'     : '#555',
                fontWeight:   activeDays === days ? 600        : 400,
                minHeight:    44,        // touch target
                minWidth:     isMobile ? 36 : 'auto',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasHoldings ? (
        <p style={{ color: '#bbb', textAlign: 'center', fontSize: 13, margin: '32px 0' }}>
          Connect a brokerage to see your performance chart.
        </p>
      ) : isLoading ? (
        <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#bbb', fontSize: 13 }}>Loading chart…</p>
        </div>
      ) : data.length < 2 ? (
        <div style={{
          height: chartHeight, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 8,
        }}>
          <p style={{ color: '#888', fontSize: 13, margin: 0 }}>⏳ Not enough data yet</p>
          <p style={{ color: '#bbb', fontSize: 12, margin: 0, textAlign: 'center' }}>
            Chart builds up over time — check back after the next sync.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: tickFontSize, fill: '#aaa' }}
              axisLine={false}
              tickLine={false}
              interval={isMobile ? 'preserveStartEnd' : 'preserveStart'}
            />
            <YAxis
              tickFormatter={(v) => fmtUsd(Number(v))}
              tick={{ fontSize: tickFontSize, fill: '#aaa' }}
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
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
            />
            <Line
              type="monotone"
              dataKey="totalValue"
              stroke="#1a1a1a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#1a1a1a' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
