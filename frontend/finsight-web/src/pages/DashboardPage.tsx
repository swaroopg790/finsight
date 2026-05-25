import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConnectBrokerage from '../components/ConnectBrokerage'
import InsightsPanel from '../components/InsightsPanel'
import api from '../lib/api'

interface Holding {
  positionId: string
  ticker: string
  name: string
  quantity: number
  currentPrice: number | null
  currentValue: number | null
  costBasis: number | null
  unrealizedGainLoss: number | null
  unrealizedGainLossPct: number | null
  accountName: string
}

interface Account {
  accountId: string
  name: string
  type: string
  balanceCurrent: number
  currency: string
  institutionName: string
}

export default function DashboardPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  // Track whether we're waiting for a Polygon price refresh after connecting
  const [pricesSyncing, setPricesSyncing] = useState(false)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: ['holdings'],
    queryFn:  () => api.get('/portfolio/holdings').then((r) => r.data),
  })

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn:  () => api.get('/portfolio/accounts').then((r) => r.data),
  })

  // Called by ConnectBrokerage after a successful exchange
  const handleBrokerageConnected = useCallback(() => {
    // Immediately refresh accounts + holdings
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['holdings'] })

    // Kick off a server-side Polygon price refresh
    api.post('/portfolio/refresh-prices').catch(() => {/* best-effort */})

    // Show "prices syncing" indicator and re-fetch after ~12s to pick up Polygon prices
    setPricesSyncing(true)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setPricesSyncing(false)
    }, 12_000)
  }, [queryClient])

  // Manual sync — lets the user trigger a price refresh at any time
  const handleSyncPrices = useCallback(() => {
    api.post('/portfolio/refresh-prices').catch(() => {})
    setPricesSyncing(true)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setPricesSyncing(false)
    }, 12_000)
  }, [queryClient])

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('finsight_token')
    navigate('/login')
  }

  // Count how many positions have market prices vs pending
  const pricedCount   = holdings.filter(h => h.currentValue != null).length
  const pendingCount  = holdings.filter(h => h.currentValue == null).length
  const allPriceless  = holdings.length > 0 && pricedCount === 0  // no prices at all yet

  // Always sum available values — partial total is better than $0
  const totalValue    = holdings.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
  const totalGainLoss = holdings.reduce((sum, h) => sum + (h.unrealizedGainLoss ?? 0), 0)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>FinSight</h1>
          <p style={{ color: '#666', margin: '4px 0 0' }}>AI Portfolio Copilot</p>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>

      {/* ── Price sync banner — only shown while actively syncing or when no prices at all ── */}
      {(pricesSyncing || allPriceless) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13,
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
                background: '#f59e0b', color: '#fff', border: 'none',
                borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
              }}
            >
              Sync Prices
            </button>
          )}
        </div>
      )}

      {/* ── Portfolio Summary ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: 24 }}>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>Total Portfolio Value</p>
          <p style={{ margin: '8px 0 0', fontSize: 36, fontWeight: 700 }}>
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {pendingCount > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>
              +{pendingCount} position{pendingCount > 1 ? 's' : ''} awaiting market data
            </p>
          )}
        </div>
        <div style={{ background: totalGainLoss >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 12, padding: 24 }}>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>Unrealised Gain / Loss</p>
          <p style={{ margin: '8px 0 0', fontSize: 36, fontWeight: 700, color: totalGainLoss >= 0 ? '#16a34a' : '#dc2626' }}>
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

      {/* ── AI Portfolio Insights ─────────────────────────────────────── */}
      <InsightsPanel hasHoldings={holdings.length > 0} />

      {/* ── Connected Accounts ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Connected Accounts</h2>
        <ConnectBrokerage onSuccess={handleBrokerageConnected} />
      </div>

      {accountsLoading ? (
        <p style={{ color: '#888' }}>Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <div style={{ border: '1px dashed #ddd', borderRadius: 12, padding: 32, textAlign: 'center', marginBottom: 32 }}>
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
              style={{ border: '1px solid #eee', borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{a.name}</p>
                <p style={{ margin: '3px 0 0', color: '#888', fontSize: 12 }}>
                  {a.institutionName} · {a.type}
                </p>
              </div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 17 }}>
                ${(a.balanceCurrent ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Holdings Table ─────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Holdings</h2>

      {holdingsLoading ? (
        <p style={{ color: '#888' }}>Loading holdings…</p>
      ) : holdings.length === 0 ? (
        <p style={{ color: '#666' }}>No holdings found. Connect a brokerage account to see your positions.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontSize: 12, color: '#888', fontWeight: 600 }}>TICKER</th>
              <th style={{ padding: '8px 12px', fontSize: 12, color: '#888', fontWeight: 600 }}>NAME</th>
              <th style={{ padding: '8px 12px', fontSize: 12, color: '#888', fontWeight: 600 }}>ACCOUNT</th>
              <th style={{ padding: '8px 12px', fontSize: 12, color: '#888', fontWeight: 600, textAlign: 'right' }}>PRICE</th>
              <th style={{ padding: '8px 12px', fontSize: 12, color: '#888', fontWeight: 600, textAlign: 'right' }}>VALUE</th>
              <th style={{ padding: '8px 12px', fontSize: 12, color: '#888', fontWeight: 600, textAlign: 'right' }}>GAIN / LOSS</th>
              <th style={{ padding: '8px 12px', fontSize: 12, color: '#888', fontWeight: 600, textAlign: 'right' }}>RETURN %</th>
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
                  <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{h.ticker}</td>
                  <td style={{ padding: '12px', color: '#555', fontSize: 14 }}>{h.name ?? '—'}</td>
                  <td style={{ padding: '12px', color: '#888', fontSize: 13 }}>{h.accountName}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: hasPrice ? '#333' : '#bbb', fontSize: 13 }}>
                    {h.currentPrice != null
                      ? `$${Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: hasPrice ? '#333' : '#bbb' }}>
                    {hasPrice
                      ? `$${Number(h.currentValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : 'Loading…'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: gainLoss != null ? gainColor : '#bbb', fontWeight: 500 }}>
                    {gainLoss != null
                      ? `${gainLoss >= 0 ? '+' : ''}$${gainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: pct != null ? gainColor : '#bbb', fontWeight: 600 }}>
                    {pct != null ? `${pct >= 0 ? '+' : ''}${Number(pct).toFixed(2)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
