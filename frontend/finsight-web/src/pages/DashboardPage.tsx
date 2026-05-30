import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { colors, radius, shadow } from '../lib/tokens'
import { liveRefetchInterval } from '../lib/marketHours'

// ── Net worth mini-card type ───────────────────────────────────────────────────
interface DashNetWorth {
  netWorth:         number
  totalAssets:      number
  totalLiabilities: number
  changeToday:      number
  changeTodayPct:   number
}

// ── Goal types (dashboard strip only) ─────────────────────────────────────────
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

// ── Format helpers ─────────────────────────────────────────────────────────────
const fmtUsd = (v: number, decimals = 2) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

function goalProbColor(p: number) {
  if (p >= 0.75) return '#16a34a'
  if (p >= 0.50) return '#d97706'
  return '#dc2626'
}

export default function DashboardPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const { isMobile, isTablet } = useBreakpoint()

  const [pricesSyncing,   setPricesSyncing]   = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [sortKey,         setSortKey]         = useState<SortKey>('value')
  const [sortDir,         setSortDir]         = useState<SortDir>('desc')
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: ['holdings'],
    queryFn:  () => api.get('/portfolio/holdings').then((r) => r.data),
    // Auto-refresh every 30 s during NYSE market hours; pauses outside hours
    refetchInterval: liveRefetchInterval(),
  })

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn:  () => api.get('/portfolio/accounts').then((r) => r.data),
  })

  const { data: dashGoals = [] } = useQuery<DashGoal[]>({
    queryKey: ['goals'],
    queryFn:  () => api.get('/goals').then((r) => r.data),
  })

  const { data: dashNetWorth } = useQuery<DashNetWorth>({
    queryKey: ['networth-summary'],
    queryFn:  () => api.get('/networth/summary').then((r) => r.data),
  })

  // News teaser — top 3 articles for "today's headlines" strip
  const { data: newsData } = useQuery<{
    articles: Array<{
      id: string; title: string; tickers: string[];
      relevantTickers: string[]; sentiment: string; relativeTime: string; publisher: string
    }>
    aiSummary: string
  }>({
    queryKey: ['news-feed'],
    queryFn:  () => api.get('/news/feed').then((r) => r.data),
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
    // Full sync: accounts + holdings + transactions + snapshot + benchmarks
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
    // Full sync + price refresh — picks up transactions, snapshot, and benchmarks
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

  useEffect(() => () => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
  }, [])

  // ── Derived values ─────────────────────────────────────────────────────────
  const pricedCount  = holdings.filter(h => h.currentValue != null).length
  const pendingCount = holdings.filter(h => h.currentValue == null).length
  const allPriceless = holdings.length > 0 && pricedCount === 0

  const totalValue    = holdings.reduce((sum, h) => sum + (h.currentValue    ?? 0), 0)
  const totalGainLoss = holdings.reduce((sum, h) => sum + (h.unrealizedGainLoss ?? 0), 0)
  const isGain        = totalGainLoss >= 0

  // Animated counter for total value
  const animatedValue = useCountUp(totalValue)

  // Dedup accounts by institution for Disconnect button
  const institutionMap = accounts.reduce<Record<string, { plaidItemId: string; name: string }>>((acc, a) => {
    if (!acc[a.plaidItemId]) acc[a.plaidItemId] = { plaidItemId: a.plaidItemId, name: a.institutionName }
    return acc
  }, {})

  // ── Sortable holdings ──────────────────────────────────────────────────────
  const sortedHoldings = useMemo(() => {
    const sorted = [...holdings].sort((a, b) => {
      let aVal = 0, bVal = 0
      if (sortKey === 'value') { aVal = a.currentValue ?? -Infinity; bVal = b.currentValue ?? -Infinity }
      if (sortKey === 'gain')  { aVal = a.unrealizedGainLoss ?? -Infinity; bVal = b.unrealizedGainLoss ?? -Infinity }
      if (sortKey === 'pct')   { aVal = a.unrealizedGainLossPct ?? -Infinity; bVal = b.unrealizedGainLossPct ?? -Infinity }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
    return sorted
  }, [holdings, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown size={12} color={colors.textMuted} style={{ opacity: 0.4 }} />
    return sortDir === 'desc'
      ? <ChevronDown size={12} color={colors.brand} />
      : <ChevronUp   size={12} color={colors.brand} />
  }

  // ── Layout values ──────────────────────────────────────────────────────────
  const outerPadding  = isMobile ? '16px' : '28px 32px'
  const cardPadding   = isMobile ? 18 : 24
  const valueFontSize = isMobile ? 30 : 38

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: outerPadding }}>

      {/* ── Page title ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px', color: colors.text }}>
          Portfolio Overview
        </h1>
        <p style={{ color: colors.textMuted, margin: '3px 0 0', fontSize: 13 }}>
          All your investments in one place
        </p>
      </div>

      {/* ── Price sync banner ──────────────────────────────────────────────── */}
      {(pricesSyncing || allPriceless) && (
        <div style={{
          display:        'flex',
          flexDirection:  isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems:     isMobile ? 'flex-start' : 'center',
          gap:            isMobile ? 10 : 0,
          background:     colors.warningBg,
          border:         `1px solid #fde68a`,
          borderRadius:   radius.md,
          padding:        '10px 16px',
          marginBottom:   16,
          fontSize:       13,
        }}>
          <span style={{ color: colors.warningText, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={14} style={{ animation: pricesSyncing ? 'spin 1s linear infinite' : 'none' }} />
            {pricesSyncing
              ? 'Fetching market prices from Polygon.io…'
              : 'Market prices not yet available — sync to load Polygon.io data.'}
          </span>
          {!pricesSyncing && (
            <button
              onClick={handleSyncPrices}
              style={{
                background:   colors.warning,
                color:        '#fff',
                border:       'none',
                borderRadius: radius.sm,
                padding:      '8px 16px',
                fontSize:     13,
                fontWeight:   600,
                cursor:       'pointer',
                minHeight:    40,
                alignSelf:    isMobile ? 'stretch' : 'auto',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          6,
              }}
            >
              <RefreshCw size={13} />
              Sync Prices
            </button>
          )}
        </div>
      )}

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap:                 12,
        marginBottom:        20,
      }}>
        {/* Total Value card */}
        <div style={{
          background:   colors.surface,
          borderRadius: radius.lg,
          padding:      cardPadding,
          border:       `1px solid ${colors.border}`,
          boxShadow:    shadow.sm,
          borderTop:    `3px solid ${colors.brand}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Portfolio Value
            </p>
            <div style={{
              width:          32,
              height:         32,
              borderRadius:   radius.sm,
              background:     colors.brandBg,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              <Wallet size={15} color={colors.brand} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: valueFontSize, fontWeight: 800, letterSpacing: '-1px', color: colors.text, lineHeight: 1 }}>
            ${animatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {pendingCount > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: colors.textMuted }}>
              +{pendingCount} position{pendingCount > 1 ? 's' : ''} awaiting market data
            </p>
          )}
        </div>

        {/* Unrealized Gain/Loss card */}
        <div style={{
          background:   colors.surface,
          borderRadius: radius.lg,
          padding:      cardPadding,
          border:       `1px solid ${colors.border}`,
          boxShadow:    shadow.sm,
          borderTop:    `3px solid ${isGain ? colors.success : colors.danger}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Unrealised Gain / Loss
            </p>
            <div style={{
              width:          32,
              height:         32,
              borderRadius:   radius.sm,
              background:     isGain ? colors.successBg : colors.dangerBg,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              {isGain
                ? <TrendingUp   size={15} color={colors.success} />
                : <TrendingDown size={15} color={colors.danger}  />}
            </div>
          </div>
          <p style={{
            margin:     0,
            fontSize:   valueFontSize,
            fontWeight: 800,
            letterSpacing: '-1px',
            color:      isGain ? colors.success : colors.danger,
            lineHeight: 1,
          }}>
            {isGain ? '+' : ''}
            {fmtUsd(totalGainLoss)}
          </p>
          {pendingCount > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: colors.textMuted }}>
              Based on {pricedCount} priced position{pricedCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Net Worth mini-card ─────────────────────────────────────────────── */}
      {dashNetWorth && (
        <div
          onClick={() => navigate('/networth')}
          style={{
            background:   'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border:       `1px solid #334155`,
            borderRadius: radius.lg,
            padding:      '14px 20px',
            marginBottom: 16,
            boxShadow:    shadow.sm,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            gap:          12,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              💰 Net Worth
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: dashNetWorth.netWorth >= 0 ? '#a5b4fc' : '#fca5a5', letterSpacing: '-0.5px' }}>
              {dashNetWorth.netWorth < 0 ? '-' : ''}
              {Math.abs(dashNetWorth.netWorth) >= 1_000_000
                ? `$${(Math.abs(dashNetWorth.netWorth) / 1_000_000).toFixed(2)}M`
                : Math.abs(dashNetWorth.netWorth) >= 1_000
                  ? `$${(Math.abs(dashNetWorth.netWorth) / 1_000).toFixed(1)}K`
                  : `$${Math.abs(dashNetWorth.netWorth).toLocaleString()}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>Today</div>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: dashNetWorth.changeToday >= 0 ? '#86efac' : '#fca5a5',
            }}>
              {dashNetWorth.changeToday >= 0 ? '+' : ''}
              {dashNetWorth.changeToday >= 1000 || dashNetWorth.changeToday <= -1000
                ? `$${(dashNetWorth.changeToday / 1000).toFixed(1)}K`
                : `$${dashNetWorth.changeToday.toFixed(0)}`}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {dashNetWorth.totalAssets >= 1_000_000
                ? `$${(dashNetWorth.totalAssets / 1_000_000).toFixed(1)}M`
                : `$${(dashNetWorth.totalAssets / 1_000).toFixed(0)}K`} assets ·{' '}
              {dashNetWorth.totalLiabilities >= 1_000_000
                ? `$${(dashNetWorth.totalLiabilities / 1_000_000).toFixed(1)}M`
                : `$${(dashNetWorth.totalLiabilities / 1_000).toFixed(0)}K`} liabilities
            </div>
          </div>
          <ChevronRight size={16} color="#475569" />
        </div>
      )}

      {/* ── Goal Progress Strip ─────────────────────────────────────────────── */}
      {dashGoals.length > 0 && (
        <div style={{
          background:   colors.surface,
          border:       `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          padding:      '16px 20px',
          marginBottom: 16,
          boxShadow:    shadow.sm,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: colors.text }}>
              <Target size={16} color="#4f46e5" />
              Goal Progress
            </div>
            <button
              onClick={() => navigate('/goals')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#4f46e5', fontSize: 12, fontWeight: 600,
              }}
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {dashGoals.slice(0, 3).map(g => {
              const prob  = g.projection?.successProbability ?? 0
              const progW = Math.round(g.progressFraction * 100)
              const shortTarget = g.targetAmount >= 1_000_000
                ? `$${(g.targetAmount / 1_000_000).toFixed(1)}M`
                : g.targetAmount >= 1_000
                  ? `$${(g.targetAmount / 1_000).toFixed(0)}k`
                  : `$${g.targetAmount}`
              return (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: colors.text, fontWeight: 600 }}>
                      {g.emoji} {g.name}
                    </span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ color: colors.textMuted }}>{g.yearsLeft}yr left</span>
                      <span style={{ fontWeight: 700, color: goalProbColor(prob) }}>
                        {(prob * 100).toFixed(0)}% odds
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: colors.pageBg, borderRadius: radius.full, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
                    <div style={{
                      height: '100%',
                      width: `${progW}%`,
                      background: progW >= 100 ? '#16a34a' : '#4f46e5',
                      borderRadius: radius.full,
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                    ${g.currentValue.toLocaleString()} of {shortTarget} · {progW}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Portfolio News Teaser ───────────────────────────────────────────── */}
      {newsData && newsData.articles.length > 0 && (
        <div style={{
          background:   colors.surface,
          border:       `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          padding:      '16px 20px',
          marginBottom: 16,
          boxShadow:    shadow.sm,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: colors.text }}>
              <Newspaper size={16} color={colors.brand} />
              Today's Headlines
            </div>
            <button
              onClick={() => navigate('/news')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.brand, fontSize: 12, fontWeight: 600,
              }}
            >
              All news <ChevronRight size={14} />
            </button>
          </div>

          {/* AI summary teaser */}
          {newsData.aiSummary && (
            <div style={{
              padding:      '10px 14px',
              borderRadius: radius.sm,
              background:   `${colors.brand}10`,
              border:       `1px solid ${colors.brand}25`,
              marginBottom: 10,
            }}>
              <p style={{ color: colors.text, fontSize: 12, margin: 0, lineHeight: 1.55, fontStyle: 'italic' }}>
                "{newsData.aiSummary.length > 180
                  ? newsData.aiSummary.slice(0, 177) + '…'
                  : newsData.aiSummary}"
              </p>
            </div>
          )}

          {/* Top 3 articles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {newsData.articles.slice(0, 3).map(a => {
              const tickers = (a.relevantTickers.length > 0 ? a.relevantTickers : a.tickers).slice(0, 3)
              const sentColor = a.sentiment === 'BULLISH' ? '#10b981'
                              : a.sentiment === 'BEARISH' ? '#ef4444' : '#94a3b8'
              return (
                <div key={a.id} style={{
                  display:     'flex',
                  alignItems:  'flex-start',
                  gap:         10,
                  padding:     '8px 10px',
                  borderRadius: radius.sm,
                  background:  colors.pageBg,
                  border:      `1px solid ${colors.border}`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: sentColor,
                    flexShrink: 0,
                    marginTop: 5,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      color: colors.text, fontSize: 12, fontWeight: 500,
                      margin: '0 0 3px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {a.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tickers.map(t => (
                        <span key={t} style={{
                          color: colors.brand, fontSize: 10, fontWeight: 700,
                          padding: '1px 5px', borderRadius: radius.full,
                          background: `${colors.brand}15`,
                        }}>{t}</span>
                      ))}
                      <span style={{ color: colors.textMuted, fontSize: 10, marginLeft: 'auto' }}>
                        {a.relativeTime}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Performance chart (full width) ─────────────────────────────────── */}
      <PerformanceChart hasHoldings={holdings.length > 0} />

      {/* ── Allocation + AI Insights ────────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr',
        gap:                 16,
        marginBottom:        8,
      }}>
        <AllocationChart hasHoldings={holdings.length > 0} />
        <InsightsPanel   hasHoldings={holdings.length > 0} />
      </div>

      {/* ── Connected Accounts ──────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        flexDirection:  isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems:     isMobile ? 'stretch' : 'center',
        gap:            isMobile ? 10 : 0,
        marginBottom:   14,
        marginTop:      8,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: colors.text, letterSpacing: '-0.3px' }}>
          Connected Accounts
        </h2>
        <ConnectBrokerage onSuccess={handleBrokerageConnected} />
      </div>

      {accountsLoading ? (
        <p style={{ color: colors.textMuted, fontSize: 13 }}>Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <div style={{
          border:       `1.5px dashed ${colors.border}`,
          borderRadius: radius.lg,
          padding:      isMobile ? 24 : 32,
          textAlign:    'center',
          marginBottom: 28,
          background:   colors.surface,
        }}>
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>No accounts connected yet.</p>
          <p style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            Click <strong style={{ color: colors.brand }}>Connect Brokerage</strong> above to link your first account.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 28 }}>
          {accounts.map((a) => (
            <div
              key={a.accountId}
              style={{
                background:    colors.surface,
                border:        `1px solid ${colors.border}`,
                borderRadius:  radius.md,
                padding:       isMobile ? '12px 14px' : '14px 20px',
                display:       'flex',
                justifyContent:'space-between',
                alignItems:    'center',
                gap:           12,
                flexWrap:      'wrap',
                transition:    'box-shadow 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = shadow.sm)}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{
                  width:          36,
                  height:         36,
                  borderRadius:   radius.sm,
                  background:     colors.brandBg,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <Wallet size={16} color={colors.brand} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </p>
                  <p style={{ margin: '2px 0 0', color: colors.textMuted, fontSize: 12 }}>
                    {a.institutionName} · {a.type}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: isMobile ? 15 : 16, color: colors.text }}>
                  {fmtUsd(a.balanceCurrent ?? 0)}
                </p>
                {institutionMap[a.plaidItemId] && (
                  <button
                    onClick={() => handleDisconnect(a.plaidItemId, a.institutionName)}
                    disabled={disconnectingId === a.plaidItemId}
                    title={`Disconnect ${a.institutionName}`}
                    style={{
                      display:     'flex',
                      alignItems:  'center',
                      gap:         5,
                      background:  'none',
                      border:      `1px solid #fca5a5`,
                      borderRadius: radius.sm,
                      padding:     '6px 11px',
                      fontSize:    12,
                      cursor:      disconnectingId === a.plaidItemId ? 'wait' : 'pointer',
                      color:       disconnectingId === a.plaidItemId ? colors.textMuted : colors.danger,
                      minHeight:   34,
                      transition:  'background 0.15s',
                      fontWeight:  500,
                    }}
                    onMouseEnter={(e) => { if (disconnectingId !== a.plaidItemId) e.currentTarget.style.background = colors.dangerBg }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                  >
                    <Unlink size={12} />
                    {disconnectingId === a.plaidItemId ? 'Removing…' : 'Disconnect'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Holdings Table ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: colors.text, letterSpacing: '-0.3px' }}>
          Holdings
        </h2>
        {holdings.length > 0 && (
          <span style={{ fontSize: 12, color: colors.textMuted }}>
            {pricedCount} of {holdings.length} priced
          </span>
        )}
      </div>

      {holdingsLoading ? (
        <p style={{ color: colors.textMuted, fontSize: 13 }}>Loading holdings…</p>
      ) : holdings.length === 0 ? (
        <div style={{
          border:       `1.5px dashed ${colors.border}`,
          borderRadius: radius.lg,
          padding:      isMobile ? 24 : 32,
          textAlign:    'center',
          background:   colors.surface,
          marginBottom: 24,
        }}>
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>
            No holdings found. Connect a brokerage account to see your positions.
          </p>
        </div>
      ) : (
        <div className="table-scroll" style={{ marginBottom: isMobile ? 0 : 32 }}>
          <table style={{
            width:           '100%',
            borderCollapse:  'collapse',
            minWidth:        isMobile ? 560 : 'auto',
            background:      colors.surface,
            borderRadius:    radius.lg,
            overflow:        'hidden',
            border:          `1px solid ${colors.border}`,
            boxShadow:       shadow.sm,
          }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: `1.5px solid ${colors.border}` }}>
                <th style={thStyle}>TICKER</th>
                {!isMobile && <th style={thStyle}>NAME</th>}
                {!isMobile && <th style={thStyle}>ACCOUNT</th>}
                <th style={{ ...thStyle, textAlign: 'right' }}>PRICE</th>
                <th
                  style={{ ...thStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('value')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: sortKey === 'value' ? colors.brand : colors.textMuted }}>
                    VALUE <SortIcon col="value" />
                  </span>
                </th>
                <th
                  style={{ ...thStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('gain')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: sortKey === 'gain' ? colors.brand : colors.textMuted }}>
                    GAIN / LOSS <SortIcon col="gain" />
                  </span>
                </th>
                <th
                  style={{ ...thStyle, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('pct')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: sortKey === 'pct' ? colors.brand : colors.textMuted }}>
                    RETURN % <SortIcon col="pct" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h, idx) => {
                const gainLoss  = h.unrealizedGainLoss    ?? null
                const pct       = h.unrealizedGainLossPct ?? null
                const hasPrice  = h.currentValue != null
                const positive  = gainLoss != null && gainLoss >= 0
                return (
                  <tr
                    key={h.positionId}
                    className="holdings-row"
                    style={{
                      borderBottom: idx < sortedHoldings.length - 1 ? `1px solid ${colors.border}` : 'none',
                    }}
                  >
                    {/* Ticker */}
                    <td style={{ padding: isMobile ? '11px 12px' : '13px 16px' }}>
                      <span style={{
                        display:        'inline-block',
                        background:     colors.brandBg,
                        color:          colors.brand,
                        borderRadius:   radius.xs,
                        padding:        '2px 7px',
                        fontSize:       isMobile ? 12 : 13,
                        fontWeight:     700,
                        fontFamily:     'monospace',
                        letterSpacing:  '0.3px',
                      }}>
                        {h.ticker}
                      </span>
                    </td>

                    {/* Name */}
                    {!isMobile && (
                      <td style={{ padding: '13px 12px', color: colors.textSecondary, fontSize: 13, maxWidth: 180 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {h.name ?? '—'}
                        </span>
                      </td>
                    )}

                    {/* Account */}
                    {!isMobile && (
                      <td style={{ padding: '13px 12px', color: colors.textMuted, fontSize: 12 }}>
                        {h.accountName}
                      </td>
                    )}

                    {/* Price */}
                    <td style={{ padding: isMobile ? '11px 10px' : '13px 12px', textAlign: 'right', color: hasPrice ? colors.text : colors.textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                      {h.currentPrice != null
                        ? fmtUsd(Number(h.currentPrice))
                        : '—'}
                    </td>

                    {/* Value */}
                    <td style={{ padding: isMobile ? '11px 10px' : '13px 12px', textAlign: 'right', fontWeight: 600, color: hasPrice ? colors.text : colors.textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                      {hasPrice
                        ? fmtUsd(Number(h.currentValue))
                        : <span style={{ color: colors.textMuted, fontSize: 11, fontStyle: 'italic' }}>Pending</span>}
                    </td>

                    {/* Gain/Loss */}
                    <td style={{ padding: isMobile ? '11px 10px' : '13px 12px', textAlign: 'right', fontWeight: 500, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                      {gainLoss != null ? (
                        <span style={{ color: positive ? colors.success : colors.danger }}>
                          {gainLoss >= 0 ? '+' : ''}
                          {fmtUsd(gainLoss)}
                        </span>
                      ) : <span style={{ color: colors.textMuted }}>—</span>}
                    </td>

                    {/* Return % pill */}
                    <td style={{ padding: isMobile ? '11px 10px' : '13px 16px', textAlign: 'right' }}>
                      {pct != null ? (
                        <span style={{
                          display:       'inline-block',
                          padding:       '3px 8px',
                          borderRadius:  radius.full,
                          fontSize:      12,
                          fontWeight:    700,
                          background:    positive ? colors.successBg : colors.dangerBg,
                          color:         positive ? colors.successText : colors.dangerText,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {pct >= 0 ? '+' : ''}{Number(pct).toFixed(2)}%
                        </span>
                      ) : <span style={{ color: colors.textMuted, fontSize: 13 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AI Chat Copilot ─────────────────────────────────────────────────── */}
      <ChatPanel hasHoldings={holdings.length > 0} />
    </div>
  )
}

// ── Table header cell style ────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding:       '10px 12px',
  fontSize:      11,
  color:         colors.textMuted,
  fontWeight:    600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace:    'nowrap',
}
