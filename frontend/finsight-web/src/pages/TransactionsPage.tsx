import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Gift, HelpCircle, RefreshCw } from 'lucide-react'
import api                    from '../lib/api'
import { useBreakpoint }      from '../hooks/useBreakpoint'
import { colors, radius, shadow } from '../lib/tokens'

// ── API response types ────────────────────────────────────────────────────────
interface Transaction {
  id:              string
  ticker:          string | null
  securityName:    string | null
  transactionType: string        // BUY, SELL, DIVIDEND, FEE, TRANSFER, OTHER
  quantity:        number | null
  price:           number | null
  amount:          number        // negative = cash out (buy)
  transactionDate: string        // ISO date
  accountName:     string
  institutionName: string
}

// Spring Data Page<T>
interface PagedResponse {
  content:       Transaction[]
  totalElements: number
  totalPages:    number
  number:        number   // current page (0-based)
  last:          boolean
  first:         boolean
}

// ── Format helpers ────────────────────────────────────────────────────────────
const fmtUsd = (v: number) =>
  '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return new Date(Number(y), Number(m) - 1, Number(day))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Transaction type badges ───────────────────────────────────────────────────
type TxType = { label: string; color: string; bg: string; icon: typeof ArrowDownCircle }

function txTypeMeta(type: string): TxType {
  switch (type.toUpperCase()) {
    case 'BUY':      return { label: 'Buy',      color: '#4f46e5', bg: '#eef2ff', icon: ArrowDownCircle }
    case 'SELL':     return { label: 'Sell',      color: '#d97706', bg: '#fef3c7', icon: ArrowUpCircle }
    case 'DIVIDEND': return { label: 'Dividend',  color: '#16a34a', bg: '#dcfce7', icon: Gift }
    case 'FEE':      return { label: 'Fee',       color: '#dc2626', bg: '#fee2e2', icon: ArrowUpCircle }
    default:         return { label: type,        color: '#64748b', bg: '#f1f5f9', icon: HelpCircle }
  }
}

const PAGE_SIZE = 25

export default function TransactionsPage() {
  const [page, setPage]     = useState(0)
  const { isMobile }        = useBreakpoint()
  const queryClient         = useQueryClient()
  const [syncing, setSyncing] = useState(false)

  const syncMutation = useMutation({
    mutationFn: () => api.post('/portfolio/sync'),
    onMutate:   () => setSyncing(true),
    onSettled:  () => {
      setSyncing(false)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const { data, isLoading, isError } = useQuery<PagedResponse>({
    queryKey: ['transactions', page],
    queryFn:  () =>
      api.get(`/portfolio/transactions?page=${page}&size=${PAGE_SIZE}`).then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

  const transactions  = data?.content    ?? []
  const totalElements = data?.totalElements ?? 0
  const totalPages    = data?.totalPages    ?? 1
  const isFirst       = data?.first         ?? true
  const isLast        = data?.last          ?? true

  const outerPadding = isMobile ? '16px' : '28px 32px'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: outerPadding }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{
                width:        32, height: 32, borderRadius: radius.sm,
                background:   colors.brandBg, display: 'flex',
                alignItems:   'center', justifyContent: 'center',
              }}>
                <Receipt size={16} color={colors.brand} />
              </div>
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px', color: colors.text }}>
                Transaction History
              </h1>
            </div>
            <p style={{ color: colors.textMuted, margin: 0, fontSize: 13 }}>
              {totalElements > 0
                ? `${totalElements} transactions across all connected accounts`
                : 'Investment transactions from your connected accounts'}
            </p>
          </div>

          {/* Sync Now button */}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncing || isLoading}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '8px 16px',
              background:   colors.brand,
              color:        '#fff',
              border:       'none',
              borderRadius: radius.sm,
              fontSize:     13,
              fontWeight:   600,
              cursor:       syncing ? 'wait' : 'pointer',
              opacity:      syncing ? 0.7 : 1,
              transition:   'opacity 0.15s',
              minHeight:    38,
              flexShrink:   0,
            }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSkeleton isMobile={isMobile} />
      ) : isError ? (
        <ErrorState />
      ) : transactions.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Transaction table */}
          <div className="table-scroll">
            <table style={{
              width:          '100%',
              borderCollapse: 'collapse',
              minWidth:       isMobile ? 520 : 'auto',
              background:     colors.surface,
              borderRadius:   radius.lg,
              overflow:       'hidden',
              border:         `1px solid ${colors.border}`,
              boxShadow:      shadow.sm,
            }}>
              <thead>
                <tr style={{ background: colors.surfaceHover, borderBottom: `1.5px solid ${colors.border}` }}>
                  <th style={thStyle}>DATE</th>
                  <th style={thStyle}>TYPE</th>
                  <th style={thStyle}>TICKER</th>
                  {!isMobile && <th style={thStyle}>SECURITY</th>}
                  {!isMobile && <th style={thStyle}>ACCOUNT</th>}
                  <th style={{ ...thStyle, textAlign: 'right' }}>QTY</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>PRICE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => {
                  const meta     = txTypeMeta(tx.transactionType)
                  const TypeIcon = meta.icon
                  const positive = tx.amount > 0
                  return (
                    <tr
                      key={tx.id}
                      className="txn-row"
                      style={{
                        borderBottom: idx < transactions.length - 1
                          ? `1px solid ${colors.border}` : 'none',
                      }}
                    >
                      {/* Date */}
                      <td style={{ padding: isMobile ? '11px 12px' : '13px 16px', color: colors.textSecondary, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {fmtDate(tx.transactionDate)}
                      </td>

                      {/* Type badge */}
                      <td style={{ padding: isMobile ? '11px 8px' : '13px 12px' }}>
                        <span style={{
                          display:     'inline-flex',
                          alignItems:  'center',
                          gap:         4,
                          padding:     '3px 8px',
                          borderRadius: radius.full,
                          fontSize:    11,
                          fontWeight:  600,
                          background:  meta.bg,
                          color:       meta.color,
                          whiteSpace:  'nowrap',
                        }}>
                          <TypeIcon size={10} />
                          {meta.label}
                        </span>
                      </td>

                      {/* Ticker */}
                      <td style={{ padding: isMobile ? '11px 8px' : '13px 12px' }}>
                        {tx.ticker ? (
                          <span style={{
                            display:       'inline-block',
                            background:    colors.brandBg,
                            color:         colors.brand,
                            borderRadius:  radius.xs,
                            padding:       '2px 7px',
                            fontSize:      isMobile ? 11 : 12,
                            fontWeight:    700,
                            fontFamily:    'monospace',
                            letterSpacing: '0.3px',
                          }}>
                            {tx.ticker}
                          </span>
                        ) : (
                          <span style={{ color: colors.textMuted, fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Security name */}
                      {!isMobile && (
                        <td style={{ padding: '13px 12px', color: colors.textSecondary, fontSize: 13, maxWidth: 160 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.securityName ?? '—'}
                          </span>
                        </td>
                      )}

                      {/* Account */}
                      {!isMobile && (
                        <td style={{ padding: '13px 12px', color: colors.textMuted, fontSize: 12 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                            {tx.accountName}
                          </div>
                          <div style={{ fontSize: 11, marginTop: 1, opacity: 0.7 }}>{tx.institutionName}</div>
                        </td>
                      )}

                      {/* Qty */}
                      <td style={{ padding: isMobile ? '11px 8px' : '13px 12px', textAlign: 'right', color: colors.textSecondary, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        {tx.quantity != null
                          ? Number(tx.quantity).toLocaleString('en-US', { maximumFractionDigits: 4 })
                          : '—'}
                      </td>

                      {/* Price */}
                      <td style={{ padding: isMobile ? '11px 8px' : '13px 12px', textAlign: 'right', color: colors.textSecondary, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        {tx.price != null ? fmtUsd(tx.price) : '—'}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: isMobile ? '11px 10px' : '13px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: positive ? colors.success : colors.danger }}>
                          {positive ? '+' : '−'}{fmtUsd(tx.amount)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div style={{
              display:        'flex',
              justifyContent: 'center',
              alignItems:     'center',
              gap:            12,
              marginTop:      20,
            }}>
              <PageBtn
                disabled={isFirst}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                label="Previous"
                icon={<ChevronLeft size={14} />}
                left
              />
              <span style={{ fontSize: 13, color: colors.textSecondary }}>
                Page {page + 1} of {totalPages}
              </span>
              <PageBtn
                disabled={isLast}
                onClick={() => setPage((p) => p + 1)}
                label="Next"
                icon={<ChevronRight size={14} />}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function LoadingSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:      isMobile ? 16 : 24,
    }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          height:       44,
          background:   'linear-gradient(90deg, var(--color-surface-hover) 25%, var(--color-border) 50%, var(--color-surface-hover) 75%)',
          backgroundSize: '200% 100%',
          animation:    'shimmer 1.5s infinite',
          borderRadius: radius.sm,
          marginBottom: 8,
          opacity:      1 - i * 0.08,
        }} />
      ))}
    </div>
  )
}

function ErrorState() {
  return (
    <div style={{
      background: colors.surface, border: `1px solid ${colors.border}`,
      borderRadius: radius.lg, padding: 32, textAlign: 'center',
    }}>
      <p style={{ color: colors.danger, fontSize: 14, margin: 0 }}>
        Failed to load transactions. Please try refreshing the page.
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      border:       `1.5px dashed ${colors.border}`,
      borderRadius: radius.lg,
      padding:      40,
      textAlign:    'center',
      background:   colors.surface,
    }}>
      <Receipt size={32} color={colors.textMuted} style={{ margin: '0 auto 12px' }} />
      <p style={{ color: colors.textSecondary, fontSize: 14, margin: 0, fontWeight: 500 }}>
        No transactions found yet.
      </p>
      <p style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, maxWidth: 380, margin: '8px auto 0' }}>
        If you just connected a brokerage, click <strong style={{ color: colors.brand }}>Sync Now</strong> above to load your transaction history immediately.
        Transactions are also synced automatically every 4 hours.
      </p>
    </div>
  )
}

function PageBtn({
  disabled, onClick, label, icon, left,
}: {
  disabled: boolean
  onClick:  () => void
  label:    string
  icon:     React.ReactNode
  left?:    boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         5,
        padding:     '8px 14px',
        background:  colors.surface,
        border:      `1px solid ${colors.border}`,
        borderRadius: radius.sm,
        cursor:      disabled ? 'not-allowed' : 'pointer',
        fontSize:    13,
        fontWeight:  500,
        color:       disabled ? colors.textMuted : colors.text,
        opacity:     disabled ? 0.5 : 1,
        transition:  'all 0.15s',
        flexDirection: left ? 'row' : 'row-reverse',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Table header style ────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding:       '10px 12px',
  fontSize:      11,
  color:         colors.textMuted,
  fontWeight:    600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace:    'nowrap',
  textAlign:     'left',
}
