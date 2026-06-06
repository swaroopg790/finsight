import { useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Wallet, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
  RefreshCw, RotateCcw, Check, Calendar, CreditCard, Repeat,
  DollarSign, AlertCircle,
} from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { cn }            from '../lib/utils'

// ── API types ─────────────────────────────────────────────────────────────────

interface CategorySpendingItem {
  category:         string
  label:            string
  emoji:            string
  actual:           number
  budget:           number
  budgetUsedPct:    number
  transactionCount: number
}

interface BudgetSummaryResponse {
  year:           number
  month:          number
  monthLabel:     string
  totalSpent:     number
  totalIncome:    number
  netCashFlow:    number
  totalBudgeted:  number
  categories:     CategorySpendingItem[]
}

interface SubscriptionItem {
  merchantName:     string
  category:         string
  categoryLabel:    string
  categoryEmoji:    string
  typicalAmount:    number
  annualCost:       number
  lastChargeDate:   string
  nextExpectedDate: string
  frequency:        string
  occurrences:      number
}

interface CashFlowEvent {
  date:          string
  type:          string
  description:   string
  category:      string
  categoryEmoji: string
  amount:        number
  predicted:     boolean
}

interface CashFlowSummaryResponse {
  currentBalance:            number
  projectedBalance30Days:    number
  totalMonthlySubscriptions: number
  totalMonthlyBills:         number
  subscriptions:             SubscriptionItem[]
  calendarEvents:            CashFlowEvent[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtUsd = (v: number, alwaysPositive = false) => {
  const abs = Math.abs(v)
  const str = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (alwaysPositive || v >= 0) return str
  return '−' + str
}

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return new Date(Number(y), Number(m) - 1, Number(day))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const fmtMonthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

// ── Category bar colour classes ───────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  GROCERIES:     '#16a34a',
  DINING:        '#f59e0b',
  SUBSCRIPTIONS: '#4f46e5',
  UTILITIES:     '#0891b2',
  TRANSPORT:     '#7c3aed',
  SHOPPING:      '#ec4899',
  HEALTHCARE:    '#dc2626',
  ENTERTAINMENT: '#c2410c',
  INCOME:        '#15803d',
  TRANSFER:      '#64748b',
  OTHER:         '#94a3b8',
}
const catColor = (cat: string) => CAT_COLOR[cat] ?? '#94a3b8'

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accentClass, negative,
}: {
  label: string; value: string; sub?: string
  icon: ReactNode; accentClass: string; negative?: boolean
}) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3 min-w-0">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', accentClass)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="label-xs mb-1">{label}</p>
        <p className={cn('text-xl font-bold font-nums tracking-tight leading-none',
          negative ? 'text-red-400' : 'text-slate-100')}>
          {value}
        </p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'budgets' | 'subscriptions' | 'cashflow'

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'overview',      label: 'Overview',      icon: <TrendingDown size={14} /> },
    { key: 'budgets',       label: 'Budgets',       icon: <Wallet size={14} /> },
    { key: 'subscriptions', label: 'Subscriptions', icon: <Repeat size={14} /> },
    { key: 'cashflow',      label: 'Cash Flow',     icon: <Calendar size={14} /> },
  ]
  return (
    <div className="glass rounded-xl p-1 flex gap-1 overflow-x-auto">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap',
            active === t.key
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Category progress bar ─────────────────────────────────────────────────────

function CategoryBar({ item }: { item: CategorySpendingItem }) {
  const color    = catColor(item.category)
  const hasBudget = item.budget > 0
  const pct      = hasBudget ? Math.min(item.budgetUsedPct, 100) : 0
  const over     = hasBudget && item.budgetUsedPct > 100

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-base">{item.emoji}</span>
          <span className="text-slate-200 text-sm font-medium truncate">{item.label}</span>
          <span className="text-slate-600 text-xs shrink-0">({item.transactionCount} txns)</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasBudget && (
            <span className={cn('text-xs font-semibold', over ? 'text-red-400' : 'text-slate-500')}>
              {Math.round(item.budgetUsedPct)}% of {fmtUsd(item.budget, true)}
            </span>
          )}
          <span className="text-slate-200 text-sm font-bold font-nums">
            {fmtUsd(item.actual, true)}
          </span>
        </div>
      </div>
      {hasBudget && (
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: over ? '#ef4444' : color }}
          />
        </div>
      )}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: BudgetSummaryResponse | undefined }) {
  if (!data) return null
  const topCats = data.categories.slice(0, 10)

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-2xl p-5">
        <h3 className="text-white font-bold text-sm mb-4 tracking-tight">Spending by Category</h3>
        {topCats.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No bank transactions found yet. Sync your accounts to see spending data.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {topCats.map(cat => <CategoryBar key={cat.category} item={cat} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Budgets tab ───────────────────────────────────────────────────────────────

const DEFAULT_BUDGETS: Record<string, number> = {
  GROCERIES:     600,
  DINING:        300,
  SUBSCRIPTIONS: 200,
  UTILITIES:     350,
  TRANSPORT:     150,
  SHOPPING:      400,
  HEALTHCARE:    100,
  ENTERTAINMENT: 150,
}

const ALL_CATEGORIES = [
  { key: 'GROCERIES',     label: 'Groceries',         emoji: '🛒' },
  { key: 'DINING',        label: 'Dining & Coffee',   emoji: '🍽️' },
  { key: 'SUBSCRIPTIONS', label: 'Subscriptions',     emoji: '📱' },
  { key: 'UTILITIES',     label: 'Utilities & Bills', emoji: '⚡' },
  { key: 'TRANSPORT',     label: 'Transport',          emoji: '🚗' },
  { key: 'SHOPPING',      label: 'Shopping',           emoji: '🛍️' },
  { key: 'HEALTHCARE',    label: 'Healthcare',         emoji: '🏥' },
  { key: 'ENTERTAINMENT', label: 'Entertainment',      emoji: '🎬' },
]

function BudgetsTab({
  data, onSave,
}: {
  data: BudgetSummaryResponse | undefined
  onSave: (targets: Record<string, number>) => void
}) {
  const existingBudgets: Record<string, number> = {}
  if (data) {
    data.categories.forEach(c => {
      if (c.budget > 0) existingBudgets[c.category] = c.budget
    })
  }

  const [localBudgets, setLocalBudgets] = useState<Record<string, number>>(
    Object.fromEntries(
      ALL_CATEGORIES.map(c => [c.key, existingBudgets[c.key] ?? DEFAULT_BUDGETS[c.key] ?? 0])
    )
  )
  const [saved, setSaved] = useState(false)

  const actualMap: Record<string, number> = {}
  if (data) data.categories.forEach(c => { actualMap[c.category] = c.actual })

  const handleSave = () => {
    onSave(localBudgets)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-sm tracking-tight">Monthly Budget Targets</h3>
          <button
            onClick={handleSave}
            className={cn(
              'flex items-center gap-1.5 btn-primary text-xs px-4 py-2',
              saved && 'bg-emerald-600 hover:bg-emerald-500'
            )}
          >
            {saved ? <><Check size={13} /> Saved!</> : 'Save Budgets'}
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {ALL_CATEGORIES.map(cat => {
            const actual = actualMap[cat.key] ?? 0
            const budget = localBudgets[cat.key] ?? 0
            const pct    = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0
            const over   = budget > 0 && actual > budget
            const color  = catColor(cat.key)

            return (
              <div key={cat.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg shrink-0">{cat.emoji}</span>
                  <span className="text-slate-200 text-sm font-medium flex-1 min-w-0 truncate">{cat.label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-slate-500 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={localBudgets[cat.key] ?? ''}
                      onChange={e => setLocalBudgets(prev => ({
                        ...prev, [cat.key]: parseFloat(e.target.value) || 0,
                      }))}
                      className="w-20 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-200 text-xs font-bold font-nums text-right focus:outline-none focus:border-indigo-500/50"
                    />
                    <span className="text-slate-600 text-xs whitespace-nowrap">/mo</span>
                  </div>
                  {actual > 0 && (
                    <span className={cn(
                      'text-xs font-semibold shrink-0 w-20 text-right font-nums',
                      over ? 'text-red-400' : 'text-slate-400'
                    )}>
                      {fmtUsd(actual, true)} spent
                    </span>
                  )}
                </div>
                {budget > 0 && (
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: over ? '#ef4444' : color }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Subscriptions tab ─────────────────────────────────────────────────────────

function SubscriptionsTab({ data }: { data: CashFlowSummaryResponse | undefined }) {
  if (!data) return null
  const subs = data.subscriptions
  const totalMonthly = subs.reduce((sum, s) => sum + (s.frequency === 'Monthly' ? s.typicalAmount : 0), 0)
  const totalAnnual  = subs.reduce((sum, s) => sum + s.annualCost, 0)

  return (
    <div className="flex flex-col gap-4">
      {subs.length > 0 && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border-l-2 border-l-indigo-500">
          <AlertCircle size={20} className="text-indigo-400 shrink-0" />
          <div>
            <p className="text-white text-sm font-semibold mb-0.5">
              You're paying {fmtUsd(totalMonthly, true)}/month in recurring charges
            </p>
            <p className="text-slate-500 text-xs">
              {fmtUsd(totalAnnual, true)}/year across {subs.length} detected subscriptions and bills
            </p>
          </div>
        </div>
      )}

      {subs.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <Repeat size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            No recurring charges detected yet. Sync more transaction history to detect subscriptions.
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          {subs.map((sub, idx) => (
            <div
              key={sub.merchantName + idx}
              className={cn(
                'flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.02]',
                idx < subs.length - 1 && 'border-b border-white/[0.04]'
              )}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: catColor(sub.category) + '18' }}
              >
                {sub.categoryEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{sub.merchantName}</p>
                <p className="text-slate-500 text-xs">
                  {sub.categoryLabel} · {sub.frequency} · {sub.occurrences}× detected
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white text-sm font-bold font-nums">
                  {fmtUsd(sub.typicalAmount, true)}/{sub.frequency === 'Monthly' ? 'mo' : sub.frequency === 'Weekly' ? 'wk' : 'biweekly'}
                </p>
                <p className="text-slate-500 text-xs">
                  Next: {sub.nextExpectedDate ? fmtDate(sub.nextExpectedDate) : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cash Flow tab ─────────────────────────────────────────────────────────────

function CashFlowTab({ data }: { data: CashFlowSummaryResponse | undefined }) {
  if (!data) return null
  const events  = data.calendarEvents
  const today   = new Date().toISOString().split('T')[0]
  const upcoming = events.filter(e => e.date >= today).slice(0, 20)
  const recent   = events.filter(e => e.date < today).slice(0, 10)
  const balDelta = data.projectedBalance30Days - data.currentBalance
  const balUp    = balDelta >= 0

  return (
    <div className="flex flex-col gap-4">
      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="label-xs mb-1.5">Current Balance</p>
          <p className="text-slate-100 text-xl font-bold font-nums tracking-tight">
            {fmtUsd(data.currentBalance, true)}
          </p>
          <p className="text-slate-500 text-xs mt-1">Checking + Savings</p>
        </div>
        <div className={cn('glass rounded-2xl p-4 border',
          balUp ? 'border-emerald-500/20' : 'border-red-500/20')}>
          <p className="label-xs mb-1.5">Projected (30 days)</p>
          <p className={cn('text-xl font-bold font-nums tracking-tight',
            balUp ? 'text-emerald-400' : 'text-red-400')}>
            {fmtUsd(data.projectedBalance30Days, true)}
          </p>
          <p className={cn('text-xs mt-1 flex items-center gap-1',
            balUp ? 'text-emerald-400' : 'text-red-400')}>
            {balUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {balUp ? '+' : ''}{fmtUsd(balDelta, false)} projected
          </p>
        </div>
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
            <Calendar size={14} className="text-indigo-400" />
            <h3 className="text-white text-sm font-bold">Upcoming (next 30 days)</h3>
          </div>
          {upcoming.map((ev, idx) => {
            const isIncome = ev.amount > 0
            return (
              <div key={idx} className={cn(
                'flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors',
                idx < upcoming.length - 1 && 'border-b border-white/[0.04]'
              )}>
                <div className="w-9 text-center shrink-0">
                  <span className="text-base">{ev.categoryEmoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate">
                    {ev.description}
                    {ev.predicted && (
                      <span className="ml-2 text-xs text-slate-600 bg-white/[0.04] rounded px-1.5 py-0.5">
                        predicted
                      </span>
                    )}
                  </p>
                  <p className="text-slate-500 text-xs">{fmtDate(ev.date)}</p>
                </div>
                <span className={cn('text-sm font-bold font-nums shrink-0',
                  isIncome ? 'text-emerald-400' : 'text-slate-200')}>
                  {isIncome ? '+' : '−'}{fmtUsd(ev.amount, true)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent actuals */}
      {recent.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
            <RotateCcw size={14} className="text-slate-500" />
            <h3 className="text-white text-sm font-bold">Recent (last 30 days)</h3>
          </div>
          {recent.map((ev, idx) => {
            const isIncome = ev.amount > 0
            return (
              <div key={idx} className={cn(
                'flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors',
                idx < recent.length - 1 && 'border-b border-white/[0.04]'
              )}>
                <div className="w-9 text-center shrink-0">
                  <span className="text-base">{ev.categoryEmoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate">{ev.description}</p>
                  <p className="text-slate-500 text-xs">{fmtDate(ev.date)}</p>
                </div>
                <span className={cn('text-sm font-semibold font-nums shrink-0',
                  isIncome ? 'text-emerald-400' : 'text-slate-400')}>
                  {isIncome ? '+' : '−'}{fmtUsd(ev.amount, true)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {upcoming.length === 0 && recent.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center">
          <Calendar size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            No calendar events yet. Sync bank transactions to see upcoming bills and income.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { isMobile }   = useBreakpoint()
  const queryClient    = useQueryClient()
  const [tab, setTab]  = useState<Tab>('overview')

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [syncing, setSyncing] = useState(false)

  const budgetQuery = useQuery<BudgetSummaryResponse>({
    queryKey: ['budget', year, month],
    queryFn:  () =>
      api.get(`/budget/summary?year=${year}&month=${month}`).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })

  const cashflowQuery = useQuery<CashFlowSummaryResponse>({
    queryKey: ['cashflow'],
    queryFn:  () => api.get('/cashflow/summary').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const saveBudgetsMutation = useMutation({
    mutationFn: (targets: Record<string, number>) =>
      api.put('/budget/targets', { targets }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget'] }),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.post('/portfolio/sync'),
    onMutate:   () => setSyncing(true),
    onSettled:  () => {
      setSyncing(false)
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow'] })
    },
  })

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    if (isCurrentMonth) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const budget = budgetQuery.data
  const cf     = cashflowQuery.data

  const totalSpent    = budget?.totalSpent    ?? 0
  const totalIncome   = budget?.totalIncome   ?? 0
  const netCashFlow   = budget?.netCashFlow   ?? 0
  const totalBudgeted = budget?.totalBudgeted ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={cn('flex gap-4 mb-6',
          isMobile ? 'flex-col' : 'flex-row items-center justify-between')}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Wallet size={15} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Budgeting &amp; Cash Flow</h1>
          </div>
          <p className="text-slate-500 text-sm ml-11">
            Bank accounts, spending categories, subscriptions &amp; calendar
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncing}
          className={cn('btn-primary shrink-0', syncing && 'opacity-70 cursor-wait')}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </motion.div>

      {/* Month picker */}
      {(tab === 'overview' || tab === 'budgets') && (
        <div className="flex items-center gap-2 mb-4">
          <button onClick={prevMonth}
            className="btn-ghost p-2 rounded-lg">
            <ChevronLeft size={16} />
          </button>
          <span className="text-white text-sm font-bold min-w-[140px] text-center tracking-tight">
            {fmtMonthLabel(year, month)}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className={cn('btn-ghost p-2 rounded-lg', isCurrentMonth && 'opacity-40 cursor-not-allowed')}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Summary stat cards (overview only) */}
      {tab === 'overview' && (
        <div className={cn('grid gap-3 mb-5',
          isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
          <StatCard
            label="Total Spent"
            value={fmtUsd(totalSpent, true)}
            sub={`${budget?.categories.length ?? 0} categories`}
            icon={<TrendingDown size={17} className="text-red-400" />}
            accentClass="bg-red-500/10"
          />
          <StatCard
            label="Total Income"
            value={fmtUsd(totalIncome, true)}
            icon={<TrendingUp size={17} className="text-emerald-400" />}
            accentClass="bg-emerald-500/10"
          />
          <StatCard
            label="Net Cash Flow"
            value={fmtUsd(netCashFlow)}
            sub={netCashFlow >= 0 ? 'surplus' : 'deficit'}
            icon={<DollarSign size={17} className={netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'} />}
            accentClass={netCashFlow >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
            negative={netCashFlow < 0}
          />
          <StatCard
            label="Budgeted"
            value={fmtUsd(totalBudgeted, true)}
            sub={totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}% used` : 'Not set'}
            icon={<CreditCard size={17} className="text-indigo-400" />}
            accentClass="bg-indigo-500/10"
          />
        </div>
      )}

      {/* Loading / error */}
      {budgetQuery.isLoading && (
        <div className="flex flex-col gap-3 mb-5">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      )}
      {budgetQuery.isError && (
        <div className="glass rounded-xl px-4 py-3 mb-4 flex items-center gap-2 border-l-2 border-l-red-500">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">
            Failed to load budget data. Make sure your bank accounts are connected and synced.
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-4">
        <TabBar active={tab} onChange={setTab} />
      </div>

      {/* Tab content */}
      {tab === 'overview'      && <OverviewTab data={budget} />}
      {tab === 'budgets'       && (
        <BudgetsTab data={budget} onSave={targets => saveBudgetsMutation.mutate(targets)} />
      )}
      {tab === 'subscriptions' && <SubscriptionsTab data={cf} />}
      {tab === 'cashflow'      && <CashFlowTab data={cf} />}
    </div>
  )
}
