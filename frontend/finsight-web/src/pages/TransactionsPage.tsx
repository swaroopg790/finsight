import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Receipt, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Gift, HelpCircle, RefreshCw } from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { cn }            from '../lib/utils'

// ── API response types ─────────────────────────────────────────────────────────
interface Transaction {
  id: string; ticker: string | null; securityName: string | null
  transactionType: string; quantity: number | null; price: number | null
  amount: number; transactionDate: string; accountName: string; institutionName: string
}
interface PagedResponse {
  content: Transaction[]; totalElements: number; totalPages: number
  number: number; last: boolean; first: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtUsd  = (v: number) => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type TxMeta = { label: string; textClass: string; bgClass: string; icon: typeof ArrowDownCircle }
function txTypeMeta(type: string): TxMeta {
  switch (type.toUpperCase()) {
    case 'BUY':      return { label: 'Buy',      textClass: 'text-indigo-400', bgClass: 'bg-indigo-500/10', icon: ArrowDownCircle }
    case 'SELL':     return { label: 'Sell',      textClass: 'text-amber-400',  bgClass: 'bg-amber-500/10',  icon: ArrowUpCircle   }
    case 'DIVIDEND': return { label: 'Dividend',  textClass: 'text-emerald-400',bgClass: 'bg-emerald-500/10',icon: Gift            }
    case 'FEE':      return { label: 'Fee',       textClass: 'text-red-400',    bgClass: 'bg-red-500/10',    icon: ArrowUpCircle   }
    default:         return { label: type,        textClass: 'text-slate-400',  bgClass: 'bg-slate-500/10',  icon: HelpCircle      }
  }
}

const PAGE_SIZE = 25

export default function TransactionsPage() {
  const [page, setPage]         = useState(0)
  const { isMobile }            = useBreakpoint()
  const queryClient             = useQueryClient()
  const [syncing, setSyncing]   = useState(false)

  const syncMutation = useMutation({
    mutationFn: () => api.post('/portfolio/sync'),
    onMutate:   () => setSyncing(true),
    onSettled:  () => {
      setSyncing(false)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['performance'] })
      queryClient.invalidateQueries({ queryKey: ['holdings'] })
      queryClient.invalidateQueries({ queryKey: ['allocation'] })
    },
  })

  const { data, isLoading, isError } = useQuery<PagedResponse>({
    queryKey: ['transactions', page],
    queryFn:  () => api.get(`/portfolio/transactions?page=${page}&size=${PAGE_SIZE}`).then(r => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  })

  const transactions  = data?.content       ?? []
  const totalElements = data?.totalElements ?? 0
  const totalPages    = data?.totalPages    ?? 1
  const isFirst       = data?.first         ?? true
  const isLast        = data?.last          ?? true

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Receipt size={15} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Transaction History</h1>
          </div>
          <p className="text-slate-500 text-sm ml-11">
            {totalElements > 0
              ? `${totalElements} transactions across all connected accounts`
              : 'Investment transactions from your connected accounts'}
          </p>
        </div>
        <button onClick={() => syncMutation.mutate()} disabled={syncing || isLoading}
          className={cn('btn-primary', (syncing || isLoading) && 'opacity-70 cursor-wait')}>
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="glass rounded-2xl p-10 text-center">
          <p className="text-red-400 text-sm">Failed to load transactions. Is the backend running?</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="border border-dashed border-white/[0.08] rounded-2xl p-12 text-center bg-white/[0.01]">
          <Receipt size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium mb-1">No transactions yet</p>
          <p className="text-slate-600 text-xs">Connect a brokerage and sync to see your investment history.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] mb-5">
            <table className="w-full" style={{ minWidth: isMobile ? 520 : 'auto' }}>
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-4 py-3 text-left"><span className="label-xs">DATE</span></th>
                  <th className="px-3 py-3 text-left"><span className="label-xs">TYPE</span></th>
                  <th className="px-3 py-3 text-left"><span className="label-xs">TICKER</span></th>
                  {!isMobile && <th className="px-3 py-3 text-left"><span className="label-xs">ACCOUNT</span></th>}
                  {!isMobile && <th className="px-3 py-3 text-right"><span className="label-xs">QTY</span></th>}
                  {!isMobile && <th className="px-3 py-3 text-right"><span className="label-xs">PRICE</span></th>}
                  <th className="px-3 py-3 text-right"><span className="label-xs">AMOUNT</span></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => {
                  const meta    = txTypeMeta(tx.transactionType)
                  const Icon    = meta.icon
                  const isBuy   = tx.transactionType.toUpperCase() === 'BUY'
                  return (
                    <tr key={tx.id}
                      className={cn('hover:bg-white/[0.02] transition-colors', idx < transactions.length - 1 && 'border-b border-white/[0.04]')}>
                      <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(tx.transactionDate)}</td>
                      <td className="px-3 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg', meta.textClass, meta.bgClass)}>
                          <Icon size={11} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {tx.ticker
                          ? <span className="bg-indigo-500/10 text-indigo-300 text-xs font-bold font-mono px-2 py-0.5 rounded">{tx.ticker}</span>
                          : <span className="text-slate-500 text-xs">{tx.securityName ?? '—'}</span>}
                      </td>
                      {!isMobile && <td className="px-3 py-3 text-slate-500 text-xs">{tx.accountName}</td>}
                      {!isMobile && <td className="px-3 py-3 text-right text-slate-400 text-xs font-nums">{tx.quantity != null ? tx.quantity.toLocaleString() : '—'}</td>}
                      {!isMobile && <td className="px-3 py-3 text-right text-slate-400 text-xs font-nums">{tx.price != null ? fmtUsd(tx.price) : '—'}</td>}
                      <td className="px-3 py-3 text-right font-bold text-sm font-nums">
                        <span className={isBuy ? 'text-red-400' : 'text-emerald-400'}>
                          {isBuy ? '-' : '+'}{fmtUsd(tx.amount)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-xs">
              Page {page + 1} of {totalPages} · {totalElements} total
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={isFirst}
                className="btn-ghost text-xs px-3 py-2 disabled:opacity-40">
                <ChevronLeft size={14} /> Prev
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={isLast}
                className="btn-ghost text-xs px-3 py-2 disabled:opacity-40">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
