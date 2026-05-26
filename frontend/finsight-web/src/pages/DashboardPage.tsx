import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AllocationChart from '../components/AllocationChart'
import ChatPanel from '../components/ChatPanel'
import ConnectBrokerage from '../components/ConnectBrokerage'
import InsightsPanel from '../components/InsightsPanel'
import PerformanceChart from '../components/PerformanceChart'
import { useBreakpoint } from '../hooks/useBreakpoint'
import api from '../lib/api'

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
  accountId:      string
  plaidItemId:    string
  name:           string
  type:           string
  balanceCurrent: number
  currency:       string
  institutionName: string
}

export default function DashboardPage() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const { isMobile, isTablet } = useBreakpoint()

  const [pricesSyncing,  setPricesSyncing]  = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: ['holdings'],
    queryFn:  () => api.get('/portfolio/holdings').then((r) => r.data),
  })

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn:  () => api.get('/portfolio/accounts').then((r) => r.data),
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
    api.post('/portfolio/refresh-prices').catch(() => {})
    setPricesSyncing(true)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setPricesSyncing(false)
    }, 12_000)
  }, [queryClient])

  const handleSyncPrices = useCallback(() => {
    api.post('/portfolio/refresh-prices').catch(() => {})
    setPricesSyncing(true)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setPricesSyncing(false)
    }, 12_000)
  }, [queryClient])

  useEffect(() => () => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
  }, [])

  const handleLogout = async () => {
    api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('finsight_token')
    localStorage.removeItem('finsight_refresh_token')
    navigate('/login')
  }

  const pricedCount  = holdings.filter(h => h.currentValue != null).length
  const pendingCount = holdings.filter(h => h.currentValue == null).length
  const allPriceless = holdings.length > 0 && pricedCount === 0

  const totalValue    = holdings.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
  const totalGainLoss = holdings.reduce((sum, h) => sum + (h.unrealizedGainLoss ?? 0), 0)

  // Dedup accounts by institution for Disconnect button
  const institutionMap = accounts.reduce<Record<string, { plaidItemId: string; name: string }>>((acc, a) => {
    if (!acc[a.plaidItemId]) acc[a.plaidItemId] = { plaidItemId: a.plaidItemId, name: a.institutionName }
    return acc
  }, {})

  // ── Responsive values ────────────────────────────────────────────────────
  const outerPadding   = isMobile ? '16px 16px' : '32px 24px'
  const headerFontSize = isMobile ? 22 : 28
  const cardPadding    = isMobile ? 16 : 24
  const valueFontSize  = isMobile ? 28 : 36
  // Extra bottom padding on mobile so holdings table doesn't sit under the chat bar
  const bottomPadding  = isMobile ? 80 : 0

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: outerPadding, paddingBottom: bottomPadding }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   isMobile ? 20 : 32,
      }}>
        <div>
          <h1 style={{ fontSize: headerFontSize, fontWeight: 700, margin: 0 }}>FinSight</h1>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: isMobile ? 12 : 14 }}>
            AI Portfolio Copilot
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background:   'none',
            border:       '1px solid #ddd',
            borderRadius: 8,
            padding:      '8px 14px',
            cursor:       'pointer',
            fontSize:     isMobile ? 13 : 14,
            minHeight:    44,
          }}
        >
          Sign out
        </button>
      </div>

      {/* ── Price sync banner ──────────────────────────────────────────── */}
      {(pricesSyncing || allPriceless) && (
        <div style={{
          display:        'flex',
          flexDirection:  isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems:     isMobile ? 'flex-start' : 'center',
          gap:            isMobile ? 10 : 0,
          background:     '#fffbeb',
          border:         '1px solid #fde68a',
          borderRadius:   10,
          padding:        '10px 16px',
          marginBottom:   16,
          fontSize:       13,
        }}>
          <span style={{ color: '#92400e' }}>
            {pricesSyncing
              ? '⏳ Fetching market prices from Polygon.io…'
              : '⚠️ Market prices not yet available — sync to load Polygon.io data.'}
          </span>
          {!pricesSyncing && (
            <button
              onClick={handleSyncPrices}
              style={{
                background:   '#f59e0b',
                color:        '#fff',
                border:       'none',
                borderRadius: 6,
                padding:      '8px 16px',
                fontSize:     13,
                cursor:       'pointer',
                minHeight:    44,
                alignSelf:    isMobile ? 'stretch' : 'auto',
              }}
            >
              Sync Prices
            </button>
          )}
        </div>
      )}

      {/* ── Portfolio Summary cards ────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap:                 12,
        marginBottom:        16,
      }}>
        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: cardPadding }}>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>Total Portfolio Value</p>
          <p style={{ margin: '8px 0 0', fontSize: valueFontSize, fontWeight: 700 }}>
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {pendingCount > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>
              +{pendingCount} position{pendingCount > 1 ? 's' : ''} awaiting market data
            </p>
          )}
        </div>
        <div style={{
          background:   totalGainLoss >= 0 ? '#f0fdf4' : '#fef2f2',
          borderRadius: 12,
          padding:      cardPadding,
        }}>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>Unrealised Gain / Loss</p>
          <p style={{
            margin:     '8px 0 0',
            fontSize:   valueFontSize,
            fontWeight: 700,
            color:      totalGainLoss >= 0 ? '#16a34a' : '#dc2626',
          }}>
            {totalGainLoss >= 0 ? '+' : ''}
            ${totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {pendingCount > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>
              Based on {pricedCount} priced position{pricedCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Performance Chart — full width ────────────────────────────── */}
      <PerformanceChart hasHoldings={holdings.length > 0} />

      {/* ── Allocation + AI Insights ──────────────────────────────────── */}
      {/* Stack on mobile/tablet, side-by-side on wide desktop */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr',
        gap:                 16,
        marginBottom:        8,
      }}>
        <AllocationChart hasHoldings={holdings.length > 0} />
        <InsightsPanel   hasHoldings={holdings.length > 0} />
      </div>

      {/* ── Connected Accounts ─────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        flexDirection:  isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems:     isMobile ? 'stretch' : 'center',
        gap:            isMobile ? 10 : 0,
        marginBottom:   16,
        marginTop:      8,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Connected Accounts</h2>
        <ConnectBrokerage onSuccess={handleBrokerageConnected} />
      </div>

      {accountsLoading ? (
        <p style={{ color: '#888' }}>Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <div style={{
          border:       '1px dashed #ddd',
          borderRadius: 12,
          padding:      isMobile ? 24 : 32,
          textAlign:    'center',
          marginBottom: 32,
        }}>
          <p style={{ color: '#666', margin: 0 }}>No accounts connected yet.</p>
          <p style={{ color: '#999', fontSize: 13, marginTop: 4 }}>
            Click <strong>+ Connect Brokerage</strong> above to link your first account.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
          {accounts.map((a) => (
            <div
              key={a.accountId}
              style={{
                border:        '1px solid #eee',
                borderRadius:  10,
                padding:       isMobile ? '12px 14px' : '14px 20px',
                display:       'flex',
                justifyContent: 'space-between',
                alignItems:    'center',
                gap:           12,
                flexWrap:      'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: isMobile ? 14 : 15 }}>
                  {a.name}
                </p>
                <p style={{ margin: '3px 0 0', color: '#888', fontSize: 12 }}>
                  {a.institutionName} · {a.type}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: isMobile ? 15 : 17 }}>
                  ${(a.balanceCurrent ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                {institutionMap[a.plaidItemId] && (
                  <button
                    onClick={() => handleDisconnect(a.plaidItemId, a.institutionName)}
                    disabled={disconnectingId === a.plaidItemId}
                    title={`Disconnect ${a.institutionName}`}
                    style={{
                      background:   'none',
                      border:       '1px solid #fca5a5',
                      borderRadius: 6,
                      padding:      '6px 12px',
                      fontSize:     12,
                      cursor:       disconnectingId === a.plaidItemId ? 'wait' : 'pointer',
                      color:        disconnectingId === a.plaidItemId ? '#aaa' : '#dc2626',
                      minHeight:    36,
                    }}
                  >
                    {disconnectingId === a.plaidItemId ? 'Removing…' : 'Disconnect'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Holdings Table ─────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Holdings</h2>

      {holdingsLoading ? (
        <p style={{ color: '#888' }}>Loading holdings…</p>
      ) : holdings.length === 0 ? (
        <p style={{ color: '#666' }}>
          No holdings found. Connect a brokerage account to see your positions.
        </p>
      ) : (
        /* Horizontal scroll wrapper — table is full-fidelity on mobile */
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 560 : 'auto' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={thStyle}>TICKER</th>
                {/* Hide NAME + ACCOUNT columns on mobile to reduce scroll distance */}
                {!isMobile && <th style={thStyle}>NAME</th>}
                {!isMobile && <th style={thStyle}>ACCOUNT</th>}
                <th style={{ ...thStyle, textAlign: 'right' }}>PRICE</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>VALUE</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>GAIN / LOSS</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>RETURN %</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const gainLoss  = h.unrealizedGainLoss ?? null
                const pct       = h.unrealizedGainLossPct
                const hasPrice  = h.currentValue != null
                const gainColor = gainLoss != null && gainLoss >= 0 ? '#16a34a' : '#dc2626'
                return (
                  <tr key={h.positionId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: isMobile ? '10px 8px' : '12px', fontWeight: 700, fontFamily: 'monospace', fontSize: isMobile ? 13 : 14 }}>
                      {h.ticker}
                    </td>
                    {!isMobile && (
                      <td style={{ padding: '12px', color: '#555', fontSize: 14 }}>
                        {h.name ?? '—'}
                      </td>
                    )}
                    {!isMobile && (
                      <td style={{ padding: '12px', color: '#888', fontSize: 13 }}>
                        {h.accountName}
                      </td>
                    )}
                    <td style={{ padding: isMobile ? '10px 8px' : '12px', textAlign: 'right', color: hasPrice ? '#333' : '#bbb', fontSize: 13 }}>
                      {h.currentPrice != null
                        ? `$${Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td style={{ padding: isMobile ? '10px 8px' : '12px', textAlign: 'right', fontWeight: 600, color: hasPrice ? '#333' : '#bbb', fontSize: 13 }}>
                      {hasPrice
                        ? `$${Number(h.currentValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : 'Loading…'}
                    </td>
                    <td style={{ padding: isMobile ? '10px 8px' : '12px', textAlign: 'right', color: gainLoss != null ? gainColor : '#bbb', fontWeight: 500, fontSize: 13 }}>
                      {gainLoss != null
                        ? `${gainLoss >= 0 ? '+' : ''}$${gainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td style={{ padding: isMobile ? '10px 8px' : '12px', textAlign: 'right', color: pct != null ? gainColor : '#bbb', fontWeight: 600, fontSize: 13 }}>
                      {pct != null ? `${pct >= 0 ? '+' : ''}${Number(pct).toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AI Chat Copilot — floating widget / mobile bottom sheet ────── */}
      <ChatPanel hasHoldings={holdings.length > 0} />
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding:    '8px 12px',
  fontSize:   12,
  color:      '#888',
  fontWeight: 600,
}
