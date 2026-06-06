import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Plus, Trash2, Edit2, X, Check, TrendingUp, TrendingDown,
  RefreshCw, Sparkles,
} from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { cn }            from '../lib/utils'

// ── API types ─────────────────────────────────────────────────────────────────
interface ManualAsset {
  id: string; name: string; assetType: string; assetTypeLabel: string
  emoji: string; value: number; notes: string | null; updatedAt: string
}
interface ManualLiability {
  id: string; name: string; liabilityType: string; liabilityTypeLabel: string
  emoji: string; balance: number; interestRate: number | null; notes: string | null; updatedAt: string
}
interface AccountLineItem {
  name: string; institutionName: string; type: string
  subtype: string | null; balance: number; isLiability: boolean
}
interface MilestoneResponse {
  threshold: number; label: string; emoji: string; achievedOn: string
}
interface NetWorthSummary {
  netWorth: number; asOf: string; totalAssets: number
  investmentValue: number; depositoryValue: number; manualAssetValue: number
  totalLiabilities: number; creditCardBalance: number; loanBalance: number
  manualLiabilityBalance: number; changeToday: number; changeTodayPct: number
  newMilestones: MilestoneResponse[]; manualAssets: ManualAsset[]
  manualLiabilities: ManualLiability[]; plaidAccounts: AccountLineItem[]
}
interface HistoryPoint { date: string; netWorth: number; totalAssets: number; totalLiabilities: number }
interface NetWorthHistory {
  period: string; points: HistoryPoint[]; startValue: number
  endValue: number; change: number; changePct: number
}

const ASSET_TYPES = [
  { value: 'REAL_ESTATE', label: 'Real Estate',    emoji: '🏡' },
  { value: 'VEHICLE',     label: 'Vehicle',        emoji: '🚗' },
  { value: 'CASH',        label: 'Cash / Savings', emoji: '💵' },
  { value: 'CRYPTO',      label: 'Crypto',         emoji: '₿'  },
  { value: 'OTHER',       label: 'Other Asset',    emoji: '📦' },
]
const LIABILITY_TYPES = [
  { value: 'MORTGAGE',      label: 'Mortgage',      emoji: '🏠' },
  { value: 'STUDENT_LOAN',  label: 'Student Loan',  emoji: '🎓' },
  { value: 'AUTO_LOAN',     label: 'Auto Loan',     emoji: '🚗' },
  { value: 'CREDIT_CARD',   label: 'Credit Card',   emoji: '💳' },
  { value: 'PERSONAL_LOAN', label: 'Personal Loan', emoji: '📝' },
  { value: 'OTHER',         label: 'Other Debt',    emoji: '📋' },
]
const PERIODS = ['1Y', '3Y', '5Y', 'ALL']

// ── Format helpers ─────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const shortFmt = (v: number) => {
  const abs = Math.abs(v); const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return fmt.format(v)
}
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

// ── Breakdown Bar ──────────────────────────────────────────────────────────────
function BreakdownBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0)
  if (total === 0) return null
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden mb-2.5">
        {items.map(({ label, value, color }) => {
          const w = total > 0 ? (Math.max(0, value) / total) * 100 : 0
          return w > 0.5 ? (
            <div key={label} style={{ width: `${w}%`, background: color, transition: 'width 0.5s' }}
              title={`${label}: ${fmt.format(value)}`} />
          ) : null
        })}
      </div>
      <div className="flex gap-4 flex-wrap">
        {items.map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
            <span className="text-slate-400">{label}</span>
            <span className="font-semibold text-slate-200">{shortFmt(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Line item row ──────────────────────────────────────────────────────────────
function LineItem({ emoji, name, sub, value, isDebt, onEdit, onDelete }: {
  emoji: string; name: string; sub?: string; value: number; isDebt?: boolean
  onEdit?: () => void; onDelete?: () => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xl shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-slate-200 text-sm font-semibold truncate">{name}</p>
        {sub && <p className="text-slate-500 text-xs">{sub}</p>}
      </div>
      <p className={cn('font-bold text-sm font-nums shrink-0', isDebt ? 'text-red-400' : 'text-slate-200')}>
        {fmt.format(value)}
      </p>
      {onEdit && (
        <button onClick={onEdit} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
          <Edit2 size={13} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="text-red-500/60 hover:text-red-400 transition-colors p-1">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

// ── Add/Edit Form ──────────────────────────────────────────────────────────────
type FormMode = 'asset' | 'liability'
interface FormState { mode: FormMode; name: string; typeValue: string; amount: string; interestRate: string; notes: string }
function emptyForm(mode: FormMode): FormState {
  return { mode, name: '', typeValue: mode === 'asset' ? 'REAL_ESTATE' : 'MORTGAGE', amount: '', interestRate: '', notes: '' }
}

function AddEditForm({ form, editingId, onSave, onCancel, isSaving }: {
  form: FormState; editingId: string | null; onSave: (f: FormState) => void; onCancel: () => void; isSaving: boolean
}) {
  const [f, setF] = useState(form)
  const set = useCallback((k: keyof FormState, v: string) => setF(p => ({ ...p, [k]: v })), [])
  const types = f.mode === 'asset' ? ASSET_TYPES : LIABILITY_TYPES
  const amtLabel = f.mode === 'asset' ? 'Current Value ($)' : 'Outstanding Balance ($)'

  return (
    <div className="glass-sm rounded-xl p-4 mb-4">
      <p className="text-white font-semibold text-sm mb-3">
        {editingId ? '✏️ Edit' : '➕ Add'} {f.mode === 'asset' ? 'Asset' : 'Liability'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label-xs mb-1.5 block">Name</label>
          <input value={f.name} onChange={e => set('name', e.target.value)}
            placeholder={f.mode === 'asset' ? 'Primary Home' : '30-yr Mortgage'}
            className="input-field" />
        </div>
        <div>
          <label className="label-xs mb-1.5 block">Type</label>
          <select value={f.typeValue} onChange={e => set('typeValue', e.target.value)}
            className="input-field">
            {types.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label-xs mb-1.5 block">{amtLabel}</label>
          <input type="number" value={f.amount} onChange={e => set('amount', e.target.value)}
            placeholder="450000" min={0} className="input-field" />
        </div>
        {f.mode === 'liability' && (
          <div>
            <label className="label-xs mb-1.5 block">Interest Rate % (optional)</label>
            <input type="number" value={f.interestRate} onChange={e => set('interestRate', e.target.value)}
              placeholder="6.5" min={0} max={50} step={0.1} className="input-field" />
          </div>
        )}
        <div className="col-span-2">
          <label className="label-xs mb-1.5 block">Notes (optional)</label>
          <input value={f.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Any details…" className="input-field" />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
        <button onClick={() => onSave(f)} disabled={isSaving || !f.name || !f.amount}
          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
          <Check size={13} /> {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NetWorthPage() {
  const { isMobile } = useBreakpoint()
  const qc = useQueryClient()

  const [period,   setPeriod]   = useState('1Y')
  const [showForm, setShowForm] = useState<FormState | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [milestonesDismissed, setMilestonesDismissed] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)

  const { data: summary, isLoading, isError } = useQuery<NetWorthSummary>({
    queryKey: ['networth-summary'],
    queryFn:  () => api.get('/networth/summary').then(r => r.data),
  })
  const { data: history } = useQuery<NetWorthHistory>({
    queryKey: ['networth-history', period],
    queryFn:  () => api.get(`/networth/history?period=${period}`).then(r => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['networth-summary'] })
    qc.invalidateQueries({ queryKey: ['networth-history'] })
  }

  const createAsset     = useMutation({ mutationFn: (f: FormState) => api.post('/networth/assets',      { name: f.name, assetType: f.typeValue, value: Number(f.amount), notes: f.notes || null }), onSuccess: () => { invalidate(); setShowForm(null) } })
  const updateAsset     = useMutation({ mutationFn: ({ id, f }: { id: string; f: FormState }) => api.put(`/networth/assets/${id}`, { name: f.name, assetType: f.typeValue, value: Number(f.amount), notes: f.notes || null }), onSuccess: () => { invalidate(); setShowForm(null); setEditingId(null) } })
  const deleteAsset     = useMutation({ mutationFn: (id: string) => api.delete(`/networth/assets/${id}`), onSuccess: invalidate })
  const createLiability = useMutation({ mutationFn: (f: FormState) => api.post('/networth/liabilities', { name: f.name, liabilityType: f.typeValue, balance: Number(f.amount), interestRate: f.interestRate ? Number(f.interestRate) / 100 : null, notes: f.notes || null }), onSuccess: () => { invalidate(); setShowForm(null) } })
  const updateLiability = useMutation({ mutationFn: ({ id, f }: { id: string; f: FormState }) => api.put(`/networth/liabilities/${id}`, { name: f.name, liabilityType: f.typeValue, balance: Number(f.amount), interestRate: f.interestRate ? Number(f.interestRate) / 100 : null, notes: f.notes || null }), onSuccess: () => { invalidate(); setShowForm(null); setEditingId(null) } })
  const deleteLiability = useMutation({ mutationFn: (id: string) => api.delete(`/networth/liabilities/${id}`), onSuccess: invalidate })

  const handleSaveForm = (f: FormState) => {
    if (f.mode === 'asset')     editingId ? updateAsset.mutate({ id: editingId, f })     : createAsset.mutate(f)
    else                        editingId ? updateLiability.mutate({ id: editingId, f }) : createLiability.mutate(f)
  }
  const startEditAsset = (a: ManualAsset) => {
    setEditingId(a.id)
    setShowForm({ mode: 'asset', name: a.name, typeValue: a.assetType, amount: String(a.value), interestRate: '', notes: a.notes ?? '' })
  }
  const startEditLiability = (l: ManualLiability) => {
    setEditingId(l.id)
    setShowForm({ mode: 'liability', name: l.name, typeValue: l.liabilityType, amount: String(l.balance), interestRate: l.interestRate ? String(l.interestRate * 100) : '', notes: l.notes ?? '' })
  }
  const handleSnapshot = async () => {
    setSnapshotting(true)
    await api.post('/networth/snapshot').catch(() => {})
    invalidate()
    setTimeout(() => setSnapshotting(false), 1200)
  }

  const nw         = summary?.netWorth ?? 0
  const change     = summary?.changeToday ?? 0
  const isPositive = nw >= 0
  const isGain     = change >= 0
  const isSaving   = createAsset.isPending || updateAsset.isPending || createLiability.isPending || updateLiability.isPending
  const chartData  = history?.points ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">💰 Net Worth</h1>
          <p className="text-slate-500 text-sm mt-1">
            Assets − Liabilities · updated {summary ? new Date(summary.asOf).toLocaleDateString() : '…'}
          </p>
        </div>
        <button onClick={handleSnapshot} disabled={snapshotting}
          className="btn-ghost gap-2 text-xs">
          <RefreshCw size={13} className={snapshotting ? 'animate-spin' : ''} />
          {!isMobile && 'Refresh'}
        </button>
      </motion.div>

      {/* Milestone banner */}
      {!milestonesDismissed && (summary?.newMilestones?.length ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 flex items-center justify-between mb-6 shadow-glow">
          <div>
            <div className="text-3xl mb-1">{summary!.newMilestones[0].emoji}</div>
            <p className="text-white font-bold text-lg">{summary!.newMilestones[0].label}</p>
            <p className="text-white/80 text-sm mt-0.5">
              Achieved on {new Date(summary!.newMilestones[0].achievedOn).toLocaleDateString()}
            </p>
          </div>
          <button onClick={() => setMilestonesDismissed(true)}
            className="bg-white/20 hover:bg-white/30 border-0 rounded-xl p-2 text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48 text-slate-500 gap-3">
          <RefreshCw size={20} className="animate-spin" />
          Computing net worth…
        </div>
      )}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 text-red-400 text-center mb-5">
          Failed to load net worth. Check the backend is running.
        </div>
      )}

      {summary && (
        <>
          {/* Hero card */}
          <div className={cn('rounded-2xl p-6 md:p-8 mb-6 shadow-glow',
            isPositive ? 'bg-gradient-to-br from-indigo-600 to-violet-700' : 'bg-gradient-to-br from-red-700 to-red-900')}>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">Total Net Worth</p>
            <p className="text-white font-black tracking-tight font-nums leading-none mb-3"
              style={{ fontSize: isMobile ? 40 : 56 }}>
              {nw < 0 ? '-' : ''}{shortFmt(Math.abs(nw))}
            </p>
            <div className="flex items-center gap-2 text-white/90 text-sm">
              {isGain ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span className="font-nums">{change >= 0 ? '+' : ''}{shortFmt(change)} today ({pct(history?.changePct ?? 0)})</span>
            </div>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 stagger-children">
            {[
              { label: 'Total Assets',      value: shortFmt(summary.totalAssets),      border: 'border-t-indigo-500/30' },
              { label: 'Total Liabilities', value: shortFmt(summary.totalLiabilities), border: 'border-t-red-500/30',  color: 'text-red-400' },
              { label: 'Investments',       value: shortFmt(summary.investmentValue),  sub: 'brokerage' },
              { label: 'Cash & Bank',       value: shortFmt(summary.depositoryValue),  sub: 'checking + savings' },
            ].map(c => (
              <div key={c.label} className={cn('glass rounded-xl p-4', c.border && `border-t ${c.border}`)}>
                <p className="label-xs mb-1.5">{c.label}</p>
                <p className={cn('text-xl font-bold font-nums', c.color ?? 'text-white')}>{c.value}</p>
                {c.sub && <p className="text-slate-500 text-xs mt-0.5">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Asset breakdown */}
          {summary.totalAssets > 0 && (
            <div className="glass rounded-2xl px-5 py-4 mb-4">
              <p className="text-white font-semibold text-sm mb-3">Assets Breakdown</p>
              <BreakdownBar items={[
                { label: 'Investments',   value: summary.investmentValue,  color: '#6366f1' },
                { label: 'Bank Accounts', value: summary.depositoryValue,  color: '#0891b2' },
                { label: 'Manual Assets', value: summary.manualAssetValue, color: '#10b981' },
              ]} />
            </div>
          )}

          {/* Liabilities breakdown */}
          {summary.totalLiabilities > 0 && (
            <div className="glass rounded-2xl px-5 py-4 mb-4">
              <p className="text-white font-semibold text-sm mb-3">Liabilities Breakdown</p>
              <BreakdownBar items={[
                { label: 'Credit Cards',       value: summary.creditCardBalance,      color: '#ef4444' },
                { label: 'Loans',              value: summary.loanBalance,            color: '#f97316' },
                { label: 'Manual Liabilities', value: summary.manualLiabilityBalance, color: '#d97706' },
              ]} />
            </div>
          )}

          {/* History chart */}
          <div className="glass rounded-2xl px-5 py-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold text-sm">Net Worth Over Time</p>
              <div className="flex gap-1">
                {PERIODS.map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                      period === p
                        ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400 font-semibold'
                        : 'border-white/[0.06] text-slate-500 hover:text-slate-300')}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                No history yet — data will accumulate as you refresh daily.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={d => {
                        const dt = new Date(d)
                        return `${dt.toLocaleString('default', { month: 'short' })} '${String(dt.getFullYear()).slice(2)}`
                      }} />
                    <YAxis tickFormatter={shortFmt} tick={{ fontSize: 11, fill: '#64748b' }} width={68} />
                    <Tooltip
                      formatter={(v) => [shortFmt(Number(v)), '']}
                      labelFormatter={d => new Date(d).toLocaleDateString()}
                      contentStyle={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.06)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="netWorth"         stroke="#6366f1" strokeWidth={2.5} fill="url(#nwGrad)"   name="Net Worth" />
                    <Area type="monotone" dataKey="totalAssets"      stroke="#10b981" strokeWidth={1.5} fill="none" strokeDasharray="5 3" name="Assets" />
                    <Area type="monotone" dataKey="totalLiabilities" stroke="#ef4444" strokeWidth={1.5} fill="none" strokeDasharray="5 3" name="Liabilities" />
                  </AreaChart>
                </ResponsiveContainer>
                {history && (
                  <div className="flex gap-4 mt-3 flex-wrap text-xs text-slate-500">
                    <span>Start: <strong className="text-slate-300">{shortFmt(history.startValue)}</strong></span>
                    <span>End: <strong className="text-slate-300">{shortFmt(history.endValue)}</strong></span>
                    <span className={cn('font-bold', history.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {history.change >= 0 ? '+' : ''}{shortFmt(history.change)} ({pct(history.changePct)})
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Manual Assets & Liabilities */}
          <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
            {/* Assets */}
            <div className="glass rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold text-sm">🏡 Manual Assets</p>
                <button onClick={() => { setShowForm(emptyForm('asset')); setEditingId(null) }}
                  className="flex items-center gap-1 text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                  <Plus size={12} /> Add
                </button>
              </div>
              {showForm?.mode === 'asset' && (
                <AddEditForm form={showForm} editingId={editingId} onSave={handleSaveForm}
                  onCancel={() => { setShowForm(null); setEditingId(null) }} isSaving={isSaving} />
              )}
              {summary.plaidAccounts.filter(a => !a.isLiability).map((a, i) => (
                <LineItem key={i} emoji={a.type === 'investment' || a.type === 'brokerage' ? '📈' : '🏦'}
                  name={a.name} sub={`${a.institutionName} · ${a.type}`} value={a.balance} />
              ))}
              {summary.manualAssets.map(a => (
                <LineItem key={a.id} emoji={a.emoji} name={a.name} sub={a.assetTypeLabel} value={a.value}
                  onEdit={() => startEditAsset(a)}
                  onDelete={() => { if (confirm(`Delete "${a.name}"?`)) deleteAsset.mutate(a.id) }} />
              ))}
              {summary.plaidAccounts.filter(a => !a.isLiability).length === 0 && summary.manualAssets.length === 0 && (
                <p className="text-slate-600 text-xs text-center py-5">No assets yet. Add real estate, vehicles, or other assets.</p>
              )}
              <div className="flex justify-between pt-3 mt-2 border-t border-white/[0.04] text-sm">
                <span className="text-slate-400 font-semibold">Total Assets</span>
                <span className="font-bold text-emerald-400 font-nums">{shortFmt(summary.totalAssets)}</span>
              </div>
            </div>

            {/* Liabilities */}
            <div className="glass rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold text-sm">💳 Liabilities</p>
                <button onClick={() => { setShowForm(emptyForm('liability')); setEditingId(null) }}
                  className="flex items-center gap-1 text-red-400 hover:bg-red-500/10 border border-red-500/20 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                  <Plus size={12} /> Add
                </button>
              </div>
              {showForm?.mode === 'liability' && (
                <AddEditForm form={showForm} editingId={editingId} onSave={handleSaveForm}
                  onCancel={() => { setShowForm(null); setEditingId(null) }} isSaving={isSaving} />
              )}
              {summary.plaidAccounts.filter(a => a.isLiability).map((a, i) => (
                <LineItem key={i} emoji={a.type === 'credit' ? '💳' : '🏠'}
                  name={a.name} sub={`${a.institutionName} · ${a.subtype ?? a.type}`} value={a.balance} isDebt />
              ))}
              {summary.manualLiabilities.map(l => (
                <LineItem key={l.id} emoji={l.emoji} name={l.name}
                  sub={`${l.liabilityTypeLabel}${l.interestRate ? ` · ${(l.interestRate * 100).toFixed(1)}%` : ''}`}
                  value={l.balance} isDebt
                  onEdit={() => startEditLiability(l)}
                  onDelete={() => { if (confirm(`Delete "${l.name}"?`)) deleteLiability.mutate(l.id) }} />
              ))}
              {summary.plaidAccounts.filter(a => a.isLiability).length === 0 && summary.manualLiabilities.length === 0 && (
                <p className="text-slate-600 text-xs text-center py-5">No liabilities. Connect a Plaid account or add manually.</p>
              )}
              <div className="flex justify-between pt-3 mt-2 border-t border-white/[0.04] text-sm">
                <span className="text-slate-400 font-semibold">Total Liabilities</span>
                <span className="font-bold text-red-400 font-nums">{shortFmt(summary.totalLiabilities)}</span>
              </div>
            </div>
          </div>

          {/* Tip */}
          {summary.plaidAccounts.filter(a => a.isLiability).length === 0 && (
            <div className="flex items-center gap-2.5 bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl px-4 py-3 mt-4 text-sm text-indigo-300">
              <Sparkles size={14} className="shrink-0" />
              <span>
                <strong>Tip:</strong> Connect a Plaid account with <em>LIABILITIES</em> product enabled to auto-import mortgages and student loans.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
