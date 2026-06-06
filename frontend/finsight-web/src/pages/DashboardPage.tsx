import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Wallet, TrendingUp, TrendingDown, RefreshCw, Unlink, ChevronUp, ChevronDown,
  Target, ChevronRight, Newspaper,
} from 'lucide-react'
import AllocationChart   from '../components/AllocationChart'
import ChatPanel         from '../components/ChatPanel'
import ConnectBrokerage  from '../components/ConnectBrokerage'
import InsightsPanel     from '../components/InsightsPanel'
import PerformanceChart  from '../components/PerformanceChart'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useCountUp }    from '../hooks/useCountUp'
import api               from '../lib/api'
import { liveRefetchInterval } from '../lib/marketHours'
import { cn, fmtCurrency } from '../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashNetWorth {
  netWorth:         number
  totalAssets:      number
  totalLiabilities: number
  changeToday:      number
  changeTodayPct:   number
}

interface DashGoal {
  id:               string
  name:             string
  emoji:            string
  progressFraction: number
  yearsLeft:        number
  targetAmount:     number
  currentValue:     number
  projection: { successProbability: number } | null
}

interface Holding {
  positionId:            string
  ticker:                string
  name:                  string
  quantity:              number
  currentPrice:          number | null
  currentValue:          number | null
  costBasis:             number | null
  unrealizedGainLoss:    number | null
  unrealizedGainLossPct: number | null
  accountName:           string
}

interface Account {
  accountId:       string
  plaidItemId:     string
  name:            string
  type:            string
  balanceCurrent:  number
  currency:        string
  institutionName: string
}

type SortKey = 'value' | 'gain' | 'pct'
type SortDir = 'asc' | 'desc'

function goalProbColor(p: number) {
  if (p >= 0.75) return 'text-emerald-400'
  if (p >= 0.50) return 'text-amber-400'
  return 'text-red-400'
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const { isMobile, isTablet } = useBreakpoint()

  const [pricesSyncing,   setPricesSyncing]   = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [sortKey,         setSortKey]         = useState<SortKey>('value')
  const [sortDir,         setSortDir]         = useState<SortDir>('desc')
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: ['holdings'],
    queryFn:  () => api.get('/portfolio/holdings').then(r => r.data),
    refetchInterval: liveRefetchInterval(),
  })

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn:  () => api.get('/portfolio/accounts').then(r => r.data),
  })

  const { data: dashGoals = [] } = useQuery<DashGoal[]>({
    queryKey: ['goals'],
    queryFn:  () => api.get('/goals').then(r => r.data),
  })

  const { data: dashNetWorth } = useQuery<DashNetWorth>({
    queryKey: ['networth-summary'],
    queryFn:  () => api.get('/networth/summary').then(r => r.data),
  })

  const { data: newsData } = useQuery<{
    articles: Array<{
      id: string; title: string; tickers: string[];
      relevantTickers: string[]; sentiment: string; relativeTime: string; publisher: string
    }>
    aiSummary: string
  }>({
    queryKey:  ['news-feed'],
    queryFn:   () => api.get('/news/feed').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const disconnectMutation = useMutation({
    mutationFn: (plaidItemId: string) => api.delete(`/plaid/items/${plaidItemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setDisconnectingId(null)
    },
    onError: () => {
      setDisconnectingId(null)
      alert('Failed to disconnect brokerage. Please try again.')
    },
  })

  const handleDisconnect = useCallback((plaidItemId: string, institutionName: string) => {
    if (!window.confirm(`Disconnect ${institutionName}? This will remove all associated accounts and holdings.`)) return
    setDisconnectingId(plaidItemId)
    disconnectMutation.mutate(plaidItemId)
  }, [disconnectMutation])

  const handleBrokerageConnected = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['holdings'] })
    api.post('/portfolio/sync').catch(() => {})
    api.post('/portfolio/refresh-prices').catch(() => {})
    setPricesSyncing(true)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      setPricesSyncing(false)
    }, 12_000)
  }, [queryClient])

  const handleSyncPrices = useCallback(() => {
    api.post('/portfolio/sync').catch(() => {})
    api.post('/portfolio/refresh-prices').catch(() => {})
    setPricesSyncing(true)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      setPricesSyncing(false)
    }, 12_000)
  }, [queryClient])

  useEffect(() => () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const pricedCount  = holdings.filter(h => h.currentValue != null).length
  const pendingCount = holdings.filter(h => h.currentValue == null).length
  const allPriceless = holdings.length > 0 && pricedCount === 0
  const totalValue   = holdings.reduce((s, h) => s + (h.currentValue    ?? 0), 0)
  const totalGainLoss = holdings.reduce((s, h) => s + (h.unrealizedGainLoss ?? 0), 0)
  const isGain       = totalGainLoss >= 0
  const animatedValue = useCountUp(totalValue)

  const institutionMap = accounts.reduce<Record<string, { plaidItemId: string; name: string }>>((acc, a) => {
    if (!acc[a.plaidItemId]) acc[a.plaidItemId] = { plaidItemId: a.plaidItemId, name: a.institutionName }
    return acc
  }, {})

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let aVal = 0, bVal = 0
      if (sortKey === 'value') { aVal = a.currentValue ?? -Infinity; bVal = b.currentValue ?? -Infinity }
      if (sortKey === 'gain')  { aVal = a.unrealizedGainLoss ?? -Infinity; bVal = b.unrealizedGainLoss ?? -Infinity }
      if (sortKey === 'pct')   { aVal = a.unrealizedGainLossPct ?? -Infinity; bVal = b.unrealizedGainLossPct ?? -Infinity }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [holdings, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown size={12} className="opacity-30" />
    return sortDir === 'desc'
      ? <ChevronDown size={12} className="text-indigo-400" />
      : <ChevronUp   size={12} className="text-indigo-400" />
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">

      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <h1 className="text-2xl font-bold text-white tracking-tight">Portfolio Overview</h1>
        <p className="text-slate-500 text-sm mt-1">All your investments in one place</p>
      </motion.div>

      {/* Sync banner */}
      {(pricesSyncing || allPriceless) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5 text-sm text-amber-300">
          <span className="flex items-center gap-2">
            <RefreshCw size={14} className={pricesSyncing ? 'animate-spin' : ''} />
            {pricesSyncing
              ? 'Fetching market prices from Polygon.io…'
              : 'Market prices not yet available — sync to load live data.'}
          </span>
          {!pricesSyncing && (
            <button onClick={handleSyncPrices}
              className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              <RefreshCw size={13} /> Sync Prices
            </button>
          )}
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 stagger-children">
        {/* Total Value */}
        <div className="glass rounded-2xl p-5 border-t border-t-indigo-500/30">
          <div className="flex items-start justify-between mb-3">
            <p className="label-xs">Total Portfolio Value</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
              <Wallet size={15} className="text-indigo-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight font-nums leading-none">
            ${animatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {pendingCount > 0 && (
            <p className="text-slate-600 text-xs mt-2">+{pendingCount} position{pendingCount > 1 ? 's' : ''} awaiting market data</p>
          )}
        </div>

        {/* Unrealized Gain/Loss */}
        <div className={cn('glass rounded-2xl p-5', isGain ? 'border-t border-t-emerald-500/30' : 'border-t border-t-red-500/30')}>
          <div className="flex items-start justify-between mb-3">
            <p className="label-xs">Unrealised Gain / Loss</p>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              isGain ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
              {isGain
                ? <TrendingUp   size={15} className="text-emerald-400" />
                : <TrendingDown size={15} className="text-red-400" />}
            </div>
          </div>
          <p className={cn('text-3xl font-bold tracking-tight font-nums leading-none',
            isGain ? 'text-emerald-400' : 'text-red-400')}>
            {isGain ? '+' : ''}{fmtCurrency(totalGainLoss)}
          </p>
          {pendingCount > 0 && (
            <p className="text-slate-600 text-xs mt-2">Based on {pricedCount} priced position{pricedCount !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Net Worth mini-card */}
      {dashNetWorth && (
        <button
          onClick={() => navigate('/networth')}
          className="w-full text-left glass rounded-2xl px-5 py-4 mb-4 flex items-center justify-between gap-4 hover:bg-white/[0.06] transition-all duration-150 group"
        >
          <div>
            <p className="label-xs mb-1">💰 Net Worth</p>
            <p className={cn('text-2xl font-extrabold tracking-tight font-nums',
              dashNetWorth.netWorth >= 0 ? 'text-indigo-300' : 'text-red-400')}>
              {dashNetWorth.netWorth < 0 ? '-' : ''}
              {fmtCurrency(Math.abs(dashNetWorth.netWorth), 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-xs mb-1">Today</p>
            <p className={cn('text-sm font-bold font-nums', dashNetWorth.changeToday >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {dashNetWorth.changeToday >= 0 ? '+' : ''}
              {fmtCurrency(dashNetWorth.changeToday, 0)}
            </p>
            <p className="text-slate-600 text-xs">
              {fmtCurrency(dashNetWorth.totalAssets, 0)} assets · {fmtCurrency(dashNetWorth.totalLiabilities, 0)} liabilities
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
        </button>
      )}

      {/* Goal Progress Strip */}
      {dashGoals.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Target size={15} className="text-indigo-400" />
              Goal Progress
            </div>
            <button onClick={() => navigate('/goals')}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs font-semibold transition-colors">
              View All <ChevronRight size={13} />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {dashGoals.slice(0, 3).map(g => {
              const prob  = g.projection?.successProbability ?? 0
              const progW = Math.round(g.progressFraction * 100)
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-semibold">{g.emoji} {g.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{g.yearsLeft}yr left</span>
                      <span className={cn('font-bold', goalProbColor(prob))}>
                        {(prob * 100).toFixed(0)}% odds
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.04]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progW}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', progW >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                    />
                  </div>
                  <p className="text-slate-600 text-xs mt-1">${g.currentValue.toLocaleString()} of {fmtCurrency(g.targetAmount, 0)} · {progW}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Portfolio News Teaser */}
      {newsData && newsData.articles.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Newspaper size={15} className="text-indigo-400" />
              Today's Headlines
            </div>
            <button onClick={() => navigate('/news')}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs font-semibold transition-colors">
              All news <ChevronRight size={13} />
            </button>
          </div>

          {newsData.aiSummary && (
            <div className="bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl px-4 py-3 mb-3">
              <p className="text-slate-300 text-xs leading-relaxed italic">
                "{newsData.aiSummary.length > 180 ? newsData.aiSummary.slice(0, 177) + '…' : newsData.aiSummary}"
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {newsData.articles.slice(0, 3).map(a => {
              const tickers = (a.relevantTickers.length > 0 ? a.relevantTickers : a.tickers).slice(0, 3)
              const dotCls = a.sentiment === 'BULLISH' ? 'bg-emerald-400'
                           : a.sentiment === 'BEARISH' ? 'bg-red-400' : 'bg-slate-500'
              return (
                <div key={a.id} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5">
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', dotCls)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-xs font-medium truncate mb-1">{a.title}</p>
                    <div className="flex items-center gap-1.5">
                      {tickers.map(t => (
                        <span key={t} className="text-indigo-400 text-2xs font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                      <span className="text-slate-600 text-2xs ml-auto">{a.relativeTime}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Performance Chart */}
      <PerformanceChart hasHoldings={holdings.length > 0} />

      {/* Allocation + AI Insights */}
      <div className={cn('grid gap-4 mb-2', isTablet ? 'grid-cols-1' : 'grid-cols-2')}>
        <AllocationChart hasHoldings={holdings.length > 0} />
        <InsightsPanel   hasHoldings={holdings.length > 0} />
      </div>

      {/* Connected Accounts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mt-6">
        <h2 className="text-base font-bold text-white tracking-tight">Connected Accounts</h2>
        <ConnectBrokerage onSuccess={handleBrokerageConnected} />
      </div>

      {accountsLoading ? (
        <div className="flex flex-col gap-2 mb-6">
          {[1,2].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="border border-dashed border-white/[0.08] rounded-2xl p-8 text-center mb-6 bg-white/[0.01]">
          <p className="text-slate-400 text-sm mb-1">No accounts connected yet.</p>
          <p className="text-slate-600 text-xs">
            Click <span className="text-indigo-400 font-semibold">Connect Brokerage</span> above to link your first account.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {accounts.map(a => (
            <div key={a.accountId}
              className="glass-sm rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap hover:bg-white/[0.06] transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Wallet size={15} className="text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-200 text-sm font-semibold truncate">{a.name}</p>
                  <p className="text-slate-500 text-xs">{a.institutionName} · {a.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-white font-bold text-sm font-nums">{fmtCurrency(a.balanceCurrent ?? 0)}</p>
                {institutionMap[a.plaidItemId] && (
                  <button
                    onClick={() => handleDisconnect(a.plaidItemId, a.institutionName)}
                    disabled={disconnectingId === a.plaidItemId}
                    className="flex items-center gap-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Unlink size={11} />
                    {disconnectingId === a.plaidItemId ? 'Removing…' : 'Disconnect'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Holdings Table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-white tracking-tight">Holdings</h2>
        {holdings.length > 0 && (
          <span className="text-slate-500 text-xs">{pricedCount} of {holdings.length} priced</span>
        )}
      </div>

      {holdingsLoading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
        </div>
      ) : holdings.length === 0 ? (
        <div className="border border-dashed border-white/[0.08] rounded-2xl p-8 text-center bg-white/[0.01] mb-6">
          <p className="text-slate-400 text-sm">No holdings found. Connect a brokerage account to see your positions.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06] mb-8">
          <table className="w-full" style={{ minWidth: isMobile ? 560 : 'auto' }}>
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-3 text-left"><span className="label-xs">TICKER</span></th>
                {!isMobile && <th className="px-3 py-3 text-left"><span className="label-xs">NAME</span></th>}
                {!isMobile && <th className="px-3 py-3 text-left"><span className="label-xs">ACCOUNT</span></th>}
                <th className="px-3 py-3 text-right"><span className="label-xs">PRICE</span></th>
                <th className="px-3 py-3 text-right cursor-pointer select-none" onClick={() => handleSort('value')}>
                  <span className={cn('label-xs inline-flex items-center gap-1', sortKey === 'value' && 'text-indigo-400')}>
                    VALUE <SortIcon col="value" />
                  </span>
                </th>
                <th className="px-3 py-3 text-right cursor-pointer select-none" onClick={() => handleSort('gain')}>
                  <span className={cn('label-xs inline-flex items-center gap-1', sortKey === 'gain' && 'text-indigo-400')}>
                    GAIN / LOSS <SortIcon col="gain" />
                  </span>
                </th>
                <th className="px-3 py-3 text-right cursor-pointer select-none" onClick={() => handleSort('pct')}>
                  <span className={cn('label-xs inline-flex items-center gap-1', sortKey === 'pct' && 'text-indigo-400')}>
                    RETURN % <SortIcon col="pct" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h, idx) => {
                const gainLoss = h.unrealizedGainLoss    ?? null
                const pct      = h.unrealizedGainLossPct ?? null
                const hasPrice = h.currentValue != null
                const positive = gainLoss != null && gainLoss >= 0
                return (
                  <tr key={h.positionId}
                    className={cn('hover:bg-white/[0.02] transition-colors', idx < sortedHoldings.length - 1 && 'border-b border-white/[0.04]')}>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-500/10 text-indigo-300 text-xs font-bold font-mono px-2 py-0.5 rounded">
                        {h.ticker}
                      </span>
                    </td>
                    {!isMobile && (
                      <td className="px-3 py-3 text-slate-400 text-xs max-w-[160px]">
                        <span className="truncate block">{h.name ?? '—'}</span>
                      </td>
                    )}
                    {!isMobile && (
                      <td className="px-3 py-3 text-slate-600 text-xs">{h.accountName}</td>
                    )}
                    <td className="px-3 py-3 text-right font-nums text-xs text-slate-400">
                      {h.currentPrice != null ? fmtCurrency(Number(h.currentPrice)) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-nums text-sm font-semibold text-slate-200">
                      {hasPrice
                        ? fmtCurrency(Number(h.currentValue))
                        : <span className="text-slate-600 text-xs italic">Pending</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-nums text-sm">
                      {gainLoss != null ? (
                        <span className={positive ? 'text-emerald-400' : 'text-red-400'}>
                          {gainLoss >= 0 ? '+' : ''}{fmtCurrency(gainLoss)}
                        </span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {pct != null ? (
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-bold font-nums',
                          positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                          {pct >= 0 ? '+' : ''}{Number(pct).toFixed(2)}%
                        </span>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Chat Copilot */}
      <ChatPanel hasHoldings={holdings.length > 0} />
    </div>
  )
}
