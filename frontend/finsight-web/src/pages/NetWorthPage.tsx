import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { colors, radius, shadow } from '../lib/tokens'

// ── API types ─────────────────────────────────────────────────────────────────

interface ManualAsset {
  id:             string
  name:           string
  assetType:      string
  assetTypeLabel: string
  emoji:          string
  value:          number
  notes:          string | null
  updatedAt:      string
}

interface ManualLiability {
  id:                  string
  name:                string
  liabilityType:       string
  liabilityTypeLabel:  string
  emoji:               string
  balance:             number
  interestRate:        number | null
  notes:               string | null
  updatedAt:           string
}

interface AccountLineItem {
  name:            string
  institutionName: string
  type:            string
  subtype:         string | null
  balance:         number
  isLiability:     boolean
}

interface MilestoneResponse {
  threshold:   number
  label:       string
  emoji:       string
  achievedOn:  string
}

interface NetWorthSummary {
  netWorth:               number
  asOf:                   string
  totalAssets:            number
  investmentValue:        number
  depositoryValue:        number
  manualAssetValue:       number
  totalLiabilities:       number
  creditCardBalance:      number
  loanBalance:            number
  manualLiabilityBalance: number
  changeToday:            number
  changeTodayPct:         number
  newMilestones:          MilestoneResponse[]
  manualAssets:           ManualAsset[]
  manualLiabilities:      ManualLiability[]
  plaidAccounts:          AccountLineItem[]
}

interface HistoryPoint {
  date:             string
  netWorth:         number
  totalAssets:      number
  totalLiabilities: number
}

interface NetWorthHistory {
  period:     string
  points:     HistoryPoint[]
  startValue: number
  endValue:   number
  change:     number
  changePct:  number
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const fmt  = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const shortFmt = (v: number) => {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return fmt.format(v)
}
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, border }: {
  label: string; value: string; sub?: string; color?: string; border?: string
}) {
  return (
    <div style={{
      background: colors.surface, border: `1px solid ${colors.border}`,
      borderRadius: radius.lg, padding: '16px 20px', boxShadow: shadow.sm,
      borderTop: border ? `3px solid ${border}` : undefined,
    }}>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? colors.text, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── Milestone Banner ──────────────────────────────────────────────────────────

function MilestoneBanner({ milestones, onDismiss }: { milestones: MilestoneResponse[]; onDismiss: () => void }) {
  if (milestones.length === 0) return null
  const m = milestones[0]
  return (
    <div style={{
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      borderRadius: radius.lg, padding: '20px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 20, boxShadow: shadow.md, color: '#fff',
    }}>
      <div>
        <div style={{ fontSize: 28, marginBottom: 4 }}>{m.emoji}</div>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{m.label}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
          Achieved on {new Date(m.achievedOn).toLocaleDateString()}
        </div>
      </div>
      <button onClick={onDismiss} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: radius.sm, padding: '8px 12px', color: '#fff', cursor: 'pointer' }}>
        <X size={16} />
      </button>
    </div>
  )
}

// ── Breakdown bar ─────────────────────────────────────────────────────────────

function BreakdownBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0)
  if (total === 0) return null
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: radius.full, overflow: 'hidden', marginBottom: 8 }}>
        {items.map(({ label, value, color }) => {
          const w = total > 0 ? (Math.max(0, value) / total) * 100 : 0
          return w > 0.5 ? (
            <div key={label} style={{ width: `${w}%`, background: color, transition: 'width 0.5s' }} title={`${label}: ${fmt.format(value)}`} />
          ) : null
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {items.map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: colors.textSecondary }}>{label}</span>
            <span style={{ fontWeight: 600, color: colors.text }}>{shortFmt(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Line-item row ─────────────────────────────────────────────────────────────

function LineItem({ emoji, name, sub, value, color, onEdit, onDelete }: {
  emoji: string; name: string; sub?: string; value: number; color?: string;
  onEdit?: () => void; onDelete?: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0',
      borderBottom: `1px solid ${colors.border}`,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        {sub && <div style={{ fontSize: 12, color: colors.textMuted }}>{sub}</div>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: color ?? colors.text, flexShrink: 0 }}>{fmt.format(value)}</div>
      {onEdit && (
        <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: '4px' }}>
          <Edit2 size={14} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, padding: '4px' }}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

type FormMode = 'asset' | 'liability'

interface FormState {
  mode:         FormMode
  name:         string
  typeValue:    string
  amount:       string
  interestRate: string
  notes:        string
}

function emptyForm(mode: FormMode): FormState {
  return {
    mode,
    name:         '',
    typeValue:    mode === 'asset' ? 'REAL_ESTATE' : 'MORTGAGE',
    amount:       '',
    interestRate: '',
    notes:        '',
  }
}

function AddEditForm({
  form,
  editingId,
  onSave,
  onCancel,
  isSaving,
}: {
  form:      FormState
  editingId: string | null
  onSave:    (f: FormState) => void
  onCancel:  () => void
  isSaving:  boolean
}) {
  const [f, setF] = useState(form)
  const set = useCallback((k: keyof FormState, v: string) => setF(p => ({ ...p, [k]: v })), [])

  const types = f.mode === 'asset' ? ASSET_TYPES : LIABILITY_TYPES
  const amtLabel = f.mode === 'asset' ? 'Current Value ($)' : 'Outstanding Balance ($)'

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: radius.sm,
    border: `1px solid ${colors.border}`, background: colors.pageBg,
    color: colors.text, fontSize: 14, boxSizing: 'border-box',
  }

  return (
    <div style={{
      background: colors.surface, border: `1px solid ${colors.border}`,
      borderRadius: radius.lg, padding: 20, boxShadow: shadow.md, marginBottom: 16,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: colors.text, marginBottom: 16 }}>
        {editingId ? '✏️ Edit' : '➕ Add'} {f.mode === 'asset' ? 'Asset' : 'Liability'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Name</label>
          <input value={f.name} onChange={e => set('name', e.target.value)} placeholder={f.mode === 'asset' ? 'Primary Home' : '30-yr Mortgage'} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Type</label>
          <select value={f.typeValue} onChange={e => set('typeValue', e.target.value)} style={inputStyle}>
            {types.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>{amtLabel}</label>
          <input type="number" value={f.amount} onChange={e => set('amount', e.target.value)} placeholder="450000" min={0} style={inputStyle} />
        </div>
        {f.mode === 'liability' && (
          <div>
            <label style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Interest Rate % (optional)</label>
            <input type="number" value={f.interestRate} onChange={e => set('interestRate', e.target.value)} placeholder="6.5" min={0} max={50} step={0.1} style={inputStyle} />
          </div>
        )}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Notes (optional)</label>
          <input value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Any details…" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', border: `1px solid ${colors.border}`, background: colors.pageBg, color: colors.textSecondary, borderRadius: radius.sm, cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={() => onSave(f)}
          disabled={isSaving || !f.name || !f.amount}
          style={{
            padding: '8px 16px', background: '#4f46e5', color: '#fff',
            border: 'none', borderRadius: radius.sm, cursor: 'pointer',
            fontWeight: 600, opacity: isSaving ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Check size={14} /> {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const { isMobile } = useBreakpoint()
  const qc = useQueryClient()

  const [period, setPeriod]           = useState('1Y')
  const [showForm, setShowForm]       = useState<FormState | null>(null)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [milestonesDismissed, setMilestonesDismissed] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: summary, isLoading, isError } = useQuery<NetWorthSummary>({
    queryKey: ['networth-summary'],
    queryFn:  () => api.get('/networth/summary').then(r => r.data),
  })

  const { data: history } = useQuery<NetWorthHistory>({
    queryKey: ['networth-history', period],
    queryFn:  () => api.get(`/networth/history?period=${period}`).then(r => r.data),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['networth-summary'] })
    qc.invalidateQueries({ queryKey: ['networth-history'] })
  }

  const createAsset = useMutation({
    mutationFn: (f: FormState) => api.post('/networth/assets', {
      name: f.name, assetType: f.typeValue, value: Number(f.amount), notes: f.notes || null,
    }),
    onSuccess: () => { invalidate(); setShowForm(null) },
  })

  const updateAsset = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) => api.put(`/networth/assets/${id}`, {
      name: f.name, assetType: f.typeValue, value: Number(f.amount), notes: f.notes || null,
    }),
    onSuccess: () => { invalidate(); setShowForm(null); setEditingId(null) },
  })

  const deleteAsset = useMutation({
    mutationFn: (id: string) => api.delete(`/networth/assets/${id}`),
    onSuccess: invalidate,
  })

  const createLiability = useMutation({
    mutationFn: (f: FormState) => api.post('/networth/liabilities', {
      name: f.name, liabilityType: f.typeValue, balance: Number(f.amount),
      interestRate: f.interestRate ? Number(f.interestRate) / 100 : null,
      notes: f.notes || null,
    }),
    onSuccess: () => { invalidate(); setShowForm(null) },
  })

  const updateLiability = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) => api.put(`/networth/liabilities/${id}`, {
      name: f.name, liabilityType: f.typeValue, balance: Number(f.amount),
      interestRate: f.interestRate ? Number(f.interestRate) / 100 : null,
      notes: f.notes || null,
    }),
    onSuccess: () => { invalidate(); setShowForm(null); setEditingId(null) },
  })

  const deleteLiability = useMutation({
    mutationFn: (id: string) => api.delete(`/networth/liabilities/${id}`),
    onSuccess: invalidate,
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveForm = (f: FormState) => {
    if (f.mode === 'asset') {
      editingId ? updateAsset.mutate({ id: editingId, f }) : createAsset.mutate(f)
    } else {
      editingId ? updateLiability.mutate({ id: editingId, f }) : createLiability.mutate(f)
    }
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const nw          = summary?.netWorth ?? 0
  const change      = summary?.changeToday ?? 0
  const changePct   = summary?.changeTodayPct ?? 0
  const isPositive  = nw >= 0
  const isGain      = change >= 0

  const isSaving = createAsset.isPending || updateAsset.isPending ||
                   createLiability.isPending || updateLiability.isPending

  // Chart data — merge netWorth line with today's snapshot if not in history
  const chartData = history?.points ?? []

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? 16 : 24, maxWidth: 920, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, color: colors.text }}>
            💰 Net Worth
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: colors.textSecondary }}>
            Assets − Liabilities · updated {summary ? new Date(summary.asOf).toLocaleDateString() : '…'}
          </p>
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          title="Refresh snapshot"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: colors.surface,
            border: `1px solid ${colors.border}`, borderRadius: radius.md,
            color: colors.textSecondary, cursor: 'pointer', fontSize: 13,
          }}
        >
          <RefreshCw size={14} style={{ animation: snapshotting ? 'spin 1s linear infinite' : 'none' }} />
          {isMobile ? '' : 'Refresh'}
        </button>
      </div>

      {/* Milestone banner */}
      {!milestonesDismissed && (summary?.newMilestones?.length ?? 0) > 0 && (
        <MilestoneBanner
          milestones={summary!.newMilestones}
          onDismiss={() => setMilestonesDismissed(true)}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: colors.textMuted, gap: 10 }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
          Computing net worth…
        </div>
      )}

      {isError && (
        <div style={{ padding: 20, background: colors.dangerBg, borderRadius: radius.md, color: colors.danger, textAlign: 'center', marginBottom: 16 }}>
          Failed to load net worth. Check the backend is running.
        </div>
      )}

      {summary && (
        <>
          {/* Net Worth headline card */}
          <div style={{
            background: `linear-gradient(135deg, ${isPositive ? '#4f46e5' : '#dc2626'} 0%, ${isPositive ? '#7c3aed' : '#ef4444'} 100%)`,
            borderRadius: radius.xl, padding: isMobile ? '24px 20px' : '32px 36px',
            marginBottom: 20, boxShadow: shadow.lg, color: '#fff',
          }}>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Net Worth
            </div>
            <div style={{ fontSize: isMobile ? 36 : 52, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1, marginBottom: 12 }}>
              {nw < 0 ? '-' : ''}{shortFmt(Math.abs(nw))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, opacity: 0.9 }}>
                {isGain ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {change >= 0 ? '+' : ''}{shortFmt(change)} today ({pct(changePct)})
              </span>
            </div>
          </div>

          {/* Summary stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 12, marginBottom: 20,
          }}>
            <StatCard label="Total Assets"       value={shortFmt(summary.totalAssets)}      border="#4f46e5" />
            <StatCard label="Total Liabilities"  value={shortFmt(summary.totalLiabilities)} color={colors.danger} border={colors.danger} />
            <StatCard label="Investments"         value={shortFmt(summary.investmentValue)}  sub="brokerage" />
            <StatCard label="Cash & Bank"         value={shortFmt(summary.depositoryValue)}  sub="checking + savings" />
          </div>

          {/* Asset breakdown bar */}
          {summary.totalAssets > 0 && (
            <div style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: radius.lg, padding: '16px 20px', marginBottom: 16,
              boxShadow: shadow.sm,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 12 }}>Assets Breakdown</div>
              <BreakdownBar items={[
                { label: 'Investments',   value: summary.investmentValue,  color: '#4f46e5' },
                { label: 'Bank Accounts', value: summary.depositoryValue,  color: '#0891b2' },
                { label: 'Manual Assets', value: summary.manualAssetValue, color: '#16a34a' },
              ]} />
            </div>
          )}

          {/* Liabilities breakdown bar */}
          {summary.totalLiabilities > 0 && (
            <div style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: radius.lg, padding: '16px 20px', marginBottom: 16,
              boxShadow: shadow.sm,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: colors.text, marginBottom: 12 }}>Liabilities Breakdown</div>
              <BreakdownBar items={[
                { label: 'Credit Cards',       value: summary.creditCardBalance,      color: '#dc2626' },
                { label: 'Loans',              value: summary.loanBalance,            color: '#f97316' },
                { label: 'Manual Liabilities', value: summary.manualLiabilityBalance, color: '#d97706' },
              ]} />
            </div>
          )}

          {/* Net Worth History Chart */}
          <div style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: radius.lg, padding: '16px 20px', marginBottom: 20,
            boxShadow: shadow.sm,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>Net Worth Over Time</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {PERIODS.map(p => (
                  <button key={p} onClick={() => setPeriod(p)} style={{
                    padding: '4px 10px', borderRadius: radius.sm, fontSize: 12,
                    border: `1px solid ${period === p ? '#4f46e5' : colors.border}`,
                    background: period === p ? '#4f46e510' : colors.pageBg,
                    color: period === p ? '#4f46e5' : colors.textSecondary,
                    cursor: 'pointer', fontWeight: period === p ? 700 : 400,
                  }}>{p}</button>
                ))}
              </div>
            </div>

            {chartData.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 13 }}>
                No history yet — data will accumulate as you refresh daily.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.textMuted }}
                      tickFormatter={d => {
                        const dt = new Date(d)
                        return `${dt.toLocaleString('default', { month: 'short' })} '${String(dt.getFullYear()).slice(2)}`
                      }} />
                    <YAxis tickFormatter={shortFmt} tick={{ fontSize: 11, fill: colors.textMuted }} width={68} />
                    <Tooltip
                      formatter={(v) => [shortFmt(Number(v)), '']}
                      labelFormatter={d => new Date(d).toLocaleDateString()}
                      contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, fontSize: 12 }}
                    />
                    <ReferenceLine y={0} stroke={colors.border} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="netWorth"   stroke="#4f46e5" strokeWidth={2.5} fill="url(#nwGrad)" name="Net Worth" />
                    <Area type="monotone" dataKey="totalAssets" stroke="#16a34a" strokeWidth={1.5} fill="none" strokeDasharray="5 3" name="Assets" />
                    <Area type="monotone" dataKey="totalLiabilities" stroke="#dc2626" strokeWidth={1.5} fill="none" strokeDasharray="5 3" name="Liabilities" />
                  </AreaChart>
                </ResponsiveContainer>

                {history && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 12, color: colors.textSecondary }}>
                    <span>Start: <strong style={{ color: colors.text }}>{shortFmt(history.startValue)}</strong></span>
                    <span>End: <strong style={{ color: colors.text }}>{shortFmt(history.endValue)}</strong></span>
                    <span style={{ color: history.change >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                      {history.change >= 0 ? '+' : ''}{shortFmt(history.change)} ({pct(history.changePct)})
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Manual Assets & Liabilities section ──────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

            {/* Assets panel */}
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: '16px 20px', boxShadow: shadow.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>🏡 Manual Assets</div>
                <button
                  onClick={() => { setShowForm(emptyForm('asset')); setEditingId(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#4f46e510', border: '1px solid #4f46e530', borderRadius: radius.sm, color: '#4f46e5', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {showForm?.mode === 'asset' && (
                <AddEditForm form={showForm} editingId={editingId} onSave={handleSaveForm} onCancel={() => { setShowForm(null); setEditingId(null) }} isSaving={isSaving} />
              )}

              {/* Plaid investment/depository accounts (read-only) */}
              {summary.plaidAccounts.filter(a => !a.isLiability).map((a, i) => (
                <LineItem key={i}
                  emoji={a.type === 'investment' || a.type === 'brokerage' ? '📈' : '🏦'}
                  name={a.name}
                  sub={`${a.institutionName} · ${a.type}`}
                  value={a.balance}
                  color="#4f46e5"
                />
              ))}

              {/* Manual assets */}
              {summary.manualAssets.map(a => (
                <LineItem key={a.id}
                  emoji={a.emoji} name={a.name} sub={a.assetTypeLabel}
                  value={a.value}
                  onEdit={() => startEditAsset(a)}
                  onDelete={() => { if (confirm(`Delete "${a.name}"?`)) deleteAsset.mutate(a.id) }}
                />
              ))}

              {summary.plaidAccounts.filter(a => !a.isLiability).length === 0 && summary.manualAssets.length === 0 && (
                <div style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  No assets yet. Add real estate, vehicles, or other assets.
                </div>
              )}

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: colors.textSecondary, fontWeight: 600 }}>Total Assets</span>
                <span style={{ fontWeight: 800, color: '#16a34a' }}>{shortFmt(summary.totalAssets)}</span>
              </div>
            </div>

            {/* Liabilities panel */}
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: '16px 20px', boxShadow: shadow.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>💳 Liabilities</div>
                <button
                  onClick={() => { setShowForm(emptyForm('liability')); setEditingId(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#dc262610', border: '1px solid #dc262630', borderRadius: radius.sm, color: colors.danger, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {showForm?.mode === 'liability' && (
                <AddEditForm form={showForm} editingId={editingId} onSave={handleSaveForm} onCancel={() => { setShowForm(null); setEditingId(null) }} isSaving={isSaving} />
              )}

              {/* Plaid credit/loan accounts (read-only) */}
              {summary.plaidAccounts.filter(a => a.isLiability).map((a, i) => (
                <LineItem key={i}
                  emoji={a.type === 'credit' ? '💳' : '🏠'}
                  name={a.name}
                  sub={`${a.institutionName} · ${a.subtype ?? a.type}`}
                  value={a.balance}
                  color={colors.danger}
                />
              ))}

              {/* Manual liabilities */}
              {summary.manualLiabilities.map(l => (
                <LineItem key={l.id}
                  emoji={l.emoji} name={l.name}
                  sub={`${l.liabilityTypeLabel}${l.interestRate ? ` · ${(l.interestRate * 100).toFixed(1)}%` : ''}`}
                  value={l.balance}
                  color={colors.danger}
                  onEdit={() => startEditLiability(l)}
                  onDelete={() => { if (confirm(`Delete "${l.name}"?`)) deleteLiability.mutate(l.id) }}
                />
              ))}

              {summary.plaidAccounts.filter(a => a.isLiability).length === 0 && summary.manualLiabilities.length === 0 && (
                <div style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  No liabilities. Connect a Plaid account with credit/loan products or add manually.
                </div>
              )}

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: colors.textSecondary, fontWeight: 600 }}>Total Liabilities</span>
                <span style={{ fontWeight: 800, color: colors.danger }}>{shortFmt(summary.totalLiabilities)}</span>
              </div>
            </div>
          </div>

          {/* Plaid tip */}
          {summary.plaidAccounts.filter(a => a.isLiability).length === 0 && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: '#4f46e510', border: '1px solid #4f46e530',
              borderRadius: radius.md, fontSize: 13, color: '#4f46e5',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Sparkles size={14} />
              <span>
                <strong>Tip:</strong> Connect a Plaid account with <em>LIABILITIES</em> product enabled to auto-import mortgages and student loans.
              </span>
            </div>
          )}
        </>
      )}

      {/* Spinner CSS */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
