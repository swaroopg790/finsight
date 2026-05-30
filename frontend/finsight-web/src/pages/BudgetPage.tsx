import { useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
  RefreshCw, RotateCcw, Check, Calendar, CreditCard, Repeat,
  DollarSign, AlertCircle,
} from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { colors, radius, shadow } from '../lib/tokens'

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
  type:          string   // "BILL" | "INCOME" | "ACTUAL"
  description:   string
  category:      string
  categoryEmoji: string
  amount:        number   // negative = expense, positive = income
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

// ── Spending category bar colours ─────────────────────────────────────────────
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent, negative,
}: {
  label: string; value: string; sub?: string
  icon: ReactNode; accent: string; negative?: boolean
}) {
  return (
    <div style={{
      background: colors.surface,
      borderRadius: radius.lg,
      border: `1px solid ${colors.border}`,
      padding: '18px 20px',
      boxShadow: shadow.sm,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      minWidth: 0,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: radius.md,
        background: accent + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.6px', textTransform: 'uppercase', margin: '0 0 3px' }}>
          {label}
        </p>
        <p style={{
          color: negative ? colors.danger : colors.text,
          fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.5px',
        }}>
          {value}
        </p>
        {sub && (
          <p style={{ color: colors.textMuted, fontSize: 11, margin: '2px 0 0' }}>{sub}</p>
        )}
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
    <div style={{
      display: 'flex',
      background: colors.surface,
      borderRadius: radius.lg,
      border: `1px solid ${colors.border}`,
      padding: 4,
      gap: 2,
      overflowX: 'auto',
    }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 14px',
            borderRadius: radius.md,
            border: 'none',
            cursor: 'pointer',
            background: active === t.key ? colors.brand : 'transparent',
            color: active === t.key ? '#fff' : colors.textMuted,
            fontSize: 13,
            fontWeight: active === t.key ? 600 : 400,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s, color 0.15s',
          }}
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
  const color   = catColor(item.category)
  const hasBudget = item.budget > 0
  const pct     = hasBudget ? Math.min(item.budgetUsedPct, 100) : 0
  const over    = hasBudget && item.budgetUsedPct > 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 16 }}>{item.emoji}</span>
          <span style={{ color: colors.text, fontSize: 13, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
          <span style={{ color: colors.textMuted, fontSize: 11 }}>
            ({item.transactionCount} txns)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {hasBudget && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: over ? colors.danger : colors.textMuted,
            }}>
              {Math.round(item.budgetUsedPct)}% of {fmtUsd(item.budget, true)}
            </span>
          )}
          <span style={{ color: colors.text, fontSize: 14, fontWeight: 600 }}>
            {fmtUsd(item.actual, true)}
          </span>
        </div>
      </div>
      {hasBudget && (
        <div style={{
          height: 6, borderRadius: 3,
          background: colors.border,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: pct + '%',
            background: over ? colors.danger : color,
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Spending breakdown */}
      <div style={{
        background: colors.surface,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        padding: '20px 24px',
        boxShadow: shadow.sm,
      }}>
        <h3 style={{ color: colors.text, fontSize: 15, fontWeight: 700, margin: '0 0 18px', letterSpacing: '-0.3px' }}>
          Spending by Category
        </h3>
        {topCats.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>
            No bank transactions found yet. Sync your accounts to see spending data.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {topCats.map(cat => (
              <CategoryBar key={cat.category} item={cat} />
            ))}
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
  { key: 'GROCERIES',     label: 'Groceries',        emoji: '🛒' },
  { key: 'DINING',        label: 'Dining & Coffee',  emoji: '🍽️' },
  { key: 'SUBSCRIPTIONS', label: 'Subscriptions',    emoji: '📱' },
  { key: 'UTILITIES',     label: 'Utilities & Bills', emoji: '⚡' },
  { key: 'TRANSPORT',     label: 'Transport',         emoji: '🚗' },
  { key: 'SHOPPING',      label: 'Shopping',          emoji: '🛍️' },
  { key: 'HEALTHCARE',    label: 'Healthcare',        emoji: '🏥' },
  { key: 'ENTERTAINMENT', label: 'Entertainment',     emoji: '🎬' },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: colors.surface,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        padding: '20px 24px',
        boxShadow: shadow.sm,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: colors.text, fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>
            Monthly Budget Targets
          </h3>
          <button
            onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px',
              background: saved ? colors.success : colors.brand,
              color: '#fff', border: 'none', borderRadius: radius.md,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {saved ? <><Check size={14} /> Saved!</> : <>Save Budgets</>}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ALL_CATEGORIES.map(cat => {
            const actual = actualMap[cat.key] ?? 0
            const budget = localBudgets[cat.key] ?? 0
            const pct    = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0
            const over   = budget > 0 && actual > budget
            const color  = catColor(cat.key)

            return (
              <div key={cat.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Row: emoji + label + input + actual */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{cat.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: colors.text, fontSize: 13, fontWeight: 500 }}>{cat.label}</span>
                  </div>
                  {/* Budget input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ color: colors.textMuted, fontSize: 13 }}>$</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={localBudgets[cat.key] ?? ''}
                      onChange={e => setLocalBudgets(prev => ({
                        ...prev, [cat.key]: parseFloat(e.target.value) || 0,
                      }))}
                      style={{
                        width: 80, padding: '5px 8px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: radius.sm,
                        background: colors.pageBg,
                        color: colors.text,
                        fontSize: 13, fontWeight: 600,
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                    <span style={{ color: colors.textMuted, fontSize: 11, whiteSpace: 'nowrap' }}>/mo</span>
                  </div>
                  {/* Actual */}
                  {actual > 0 && (
                    <span style={{
                      color: over ? colors.danger : colors.textSecondary,
                      fontSize: 12, fontWeight: 600, flexShrink: 0, width: 80, textAlign: 'right',
                    }}>
                      {fmtUsd(actual, true)} spent
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {budget > 0 && (
                  <div style={{ height: 5, borderRadius: 3, background: colors.border, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: pct + '%',
                      background: over ? colors.danger : color,
                      borderRadius: 3, transition: 'width 0.4s ease',
                    }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary banner */}
      {subs.length > 0 && (
        <div style={{
          background: `${colors.brand}12`,
          border: `1px solid ${colors.brand}30`,
          borderRadius: radius.lg,
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <AlertCircle size={20} color={colors.brand} />
          <div>
            <p style={{ color: colors.text, fontSize: 14, fontWeight: 600, margin: '0 0 3px' }}>
              You're paying {fmtUsd(totalMonthly, true)}/month in recurring charges
            </p>
            <p style={{ color: colors.textMuted, fontSize: 12, margin: 0 }}>
              {fmtUsd(totalAnnual, true)}/year across {subs.length} detected subscriptions and bills
            </p>
          </div>
        </div>
      )}

      {subs.length === 0 ? (
        <div style={{
          background: colors.surface, borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          padding: '32px 24px', textAlign: 'center',
        }}>
          <Repeat size={32} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>
            No recurring charges detected yet. Sync more transaction history to detect subscriptions.
          </p>
        </div>
      ) : (
        <div style={{
          background: colors.surface, borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          overflow: 'hidden', boxShadow: shadow.sm,
        }}>
          {subs.map((sub, idx) => (
            <div
              key={sub.merchantName + idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 20px',
                borderBottom: idx < subs.length - 1 ? `1px solid ${colors.border}` : 'none',
              }}
            >
              {/* Emoji + name */}
              <div style={{
                width: 38, height: 38, borderRadius: radius.sm,
                background: catColor(sub.category) + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>
                {sub.categoryEmoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: colors.text, fontSize: 14, fontWeight: 600,
                  margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.merchantName}
                </p>
                <p style={{ color: colors.textMuted, fontSize: 11, margin: 0 }}>
                  {sub.categoryLabel} · {sub.frequency} · {sub.occurrences}× detected
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: colors.text, fontSize: 14, fontWeight: 700, margin: '0 0 2px' }}>
                  {fmtUsd(sub.typicalAmount, true)}/{sub.frequency === 'Monthly' ? 'mo' : sub.frequency === 'Weekly' ? 'wk' : 'biweekly'}
                </p>
                <p style={{ color: colors.textMuted, fontSize: 11, margin: 0 }}>
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
  const events = data.calendarEvents
  const today  = new Date().toISOString().split('T')[0]

  const upcoming = events.filter(e => e.date >= today).slice(0, 20)
  const recent   = events.filter(e => e.date < today).slice(0, 10)

  const balDelta = data.projectedBalance30Days - data.currentBalance
  const balUp    = balDelta >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Balance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          background: colors.surface, borderRadius: radius.lg,
          border: `1px solid ${colors.border}`, padding: '18px 20px',
          boxShadow: shadow.sm,
        }}>
          <p style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.6px', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Current Balance
          </p>
          <p style={{ color: colors.text, fontSize: 22, fontWeight: 700, margin: 0 }}>
            {fmtUsd(data.currentBalance, true)}
          </p>
          <p style={{ color: colors.textMuted, fontSize: 11, margin: '4px 0 0' }}>
            Checking + Savings
          </p>
        </div>
        <div style={{
          background: colors.surface, borderRadius: radius.lg,
          border: `1px solid ${balUp ? colors.success : colors.danger}40`,
          padding: '18px 20px',
          boxShadow: shadow.sm,
        }}>
          <p style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.6px', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Projected (30 days)
          </p>
          <p style={{ color: balUp ? colors.success : colors.danger, fontSize: 22, fontWeight: 700, margin: 0 }}>
            {fmtUsd(data.projectedBalance30Days, true)}
          </p>
          <p style={{ color: balUp ? colors.success : colors.danger, fontSize: 11, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}>
            {balUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {balUp ? '+' : ''}{fmtUsd(balDelta, false)} projected
          </p>
        </div>
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div style={{
          background: colors.surface, borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          overflow: 'hidden', boxShadow: shadow.sm,
        }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${colors.border}` }}>
            <h3 style={{ color: colors.text, fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Calendar size={15} color={colors.brand} /> Upcoming (next 30 days)
            </h3>
          </div>
          {upcoming.map((ev, idx) => {
            const isIncome = ev.amount > 0
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px',
                borderBottom: idx < upcoming.length - 1 ? `1px solid ${colors.border}` : 'none',
                background: ev.predicted ? 'transparent' : undefined,
              }}>
                <div style={{ flexShrink: 0, width: 38, textAlign: 'center' }}>
                  <span style={{ fontSize: 16 }}>{ev.categoryEmoji}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: colors.text, fontSize: 13, fontWeight: 500,
                    margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.description}
                    {ev.predicted && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: colors.textMuted,
                        background: colors.border, borderRadius: 4, padding: '1px 5px' }}>
                        predicted
                      </span>
                    )}
                  </p>
                  <p style={{ color: colors.textMuted, fontSize: 11, margin: 0 }}>
                    {fmtDate(ev.date)}
                  </p>
                </div>
                <span style={{
                  color: isIncome ? colors.success : colors.text,
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  {isIncome ? '+' : '−'}{fmtUsd(ev.amount, true)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent actuals */}
      {recent.length > 0 && (
        <div style={{
          background: colors.surface, borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          overflow: 'hidden', boxShadow: shadow.sm,
        }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${colors.border}` }}>
            <h3 style={{ color: colors.text, fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <RotateCcw size={15} color={colors.textMuted} /> Recent (last 30 days)
            </h3>
          </div>
          {recent.map((ev, idx) => {
            const isIncome = ev.amount > 0
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px',
                borderBottom: idx < recent.length - 1 ? `1px solid ${colors.border}` : 'none',
              }}>
                <div style={{ flexShrink: 0, width: 38, textAlign: 'center' }}>
                  <span style={{ fontSize: 16 }}>{ev.categoryEmoji}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: colors.text, fontSize: 13, fontWeight: 500,
                    margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.description}
                  </p>
                  <p style={{ color: colors.textMuted, fontSize: 11, margin: 0 }}>
                    {fmtDate(ev.date)}
                  </p>
                </div>
                <span style={{
                  color: isIncome ? colors.success : colors.textSecondary,
                  fontSize: 14, fontWeight: 600, flexShrink: 0,
                }}>
                  {isIncome ? '+' : '−'}{fmtUsd(ev.amount, true)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {upcoming.length === 0 && recent.length === 0 && (
        <div style={{
          background: colors.surface, borderRadius: radius.lg,
          border: `1px solid ${colors.border}`, padding: '32px 24px', textAlign: 'center',
        }}>
          <Calendar size={32} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>
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

  // Month picker state (default to current month)
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

  // Month navigation
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

  // Build summary stats
  const totalSpent    = budget?.totalSpent  ?? 0
  const totalIncome   = budget?.totalIncome ?? 0
  const netCashFlow   = budget?.netCashFlow ?? 0
  const totalBudgeted = budget?.totalBudgeted ?? 0

  const pad = isMobile ? '16px' : '28px 32px'

  return (
    <div style={{ padding: pad, maxWidth: 900, margin: '0 auto' }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 12, marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            color: colors.text, fontSize: isMobile ? 20 : 24,
            fontWeight: 800, margin: 0, letterSpacing: '-0.5px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Wallet size={isMobile ? 20 : 24} color={colors.brand} />
            Budgeting &amp; Cash Flow
          </h1>
          <p style={{ color: colors.textMuted, fontSize: 13, margin: '4px 0 0' }}>
            Bank accounts, spending categories, subscriptions &amp; calendar
          </p>
        </div>

        {/* Sync button */}
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: radius.md,
            background: syncing ? colors.border : colors.brand,
            color: syncing ? colors.textMuted : '#fff',
            border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'background 0.15s',
          }}
        >
          <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {/* ── Month picker (overview + budgets tabs only) ────────────────────── */}
      {(tab === 'overview' || tab === 'budgets') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 16,
        }}>
          <button
            onClick={prevMonth}
            style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: radius.sm, padding: '6px 10px', cursor: 'pointer',
              color: colors.text, display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{
            color: colors.text, fontSize: 14, fontWeight: 700,
            minWidth: 130, textAlign: 'center', letterSpacing: '-0.3px',
          }}>
            {fmtMonthLabel(year, month)}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: radius.sm, padding: '6px 10px',
              cursor: isCurrentMonth ? 'not-allowed' : 'pointer',
              color: isCurrentMonth ? colors.textMuted : colors.text,
              display: 'flex', alignItems: 'center', opacity: isCurrentMonth ? 0.5 : 1,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Summary stat cards (overview only) ───────────────────────────── */}
      {tab === 'overview' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          <StatCard
            label="Total Spent"
            value={fmtUsd(totalSpent, true)}
            sub={`${budget?.categories.length ?? 0} categories`}
            icon={<TrendingDown size={18} color={colors.danger} />}
            accent={colors.danger}
          />
          <StatCard
            label="Total Income"
            value={fmtUsd(totalIncome, true)}
            icon={<TrendingUp size={18} color={colors.success} />}
            accent={colors.success}
          />
          <StatCard
            label="Net Cash Flow"
            value={fmtUsd(netCashFlow)}
            sub={netCashFlow >= 0 ? 'surplus' : 'deficit'}
            icon={<DollarSign size={18} color={netCashFlow >= 0 ? colors.success : colors.danger} />}
            accent={netCashFlow >= 0 ? colors.success : colors.danger}
            negative={netCashFlow < 0}
          />
          <StatCard
            label="Budgeted"
            value={fmtUsd(totalBudgeted, true)}
            sub={totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}% used` : 'Not set'}
            icon={<CreditCard size={18} color={colors.brand} />}
            accent={colors.brand}
          />
        </div>
      )}

      {/* ── Loading / error state ─────────────────────────────────────────── */}
      {budgetQuery.isLoading && (
        <p style={{ color: colors.textMuted, fontSize: 14 }}>Loading spending data…</p>
      )}
      {budgetQuery.isError && (
        <div style={{
          background: colors.dangerBg, border: `1px solid ${colors.danger}30`,
          borderRadius: radius.md, padding: '14px 18px', marginBottom: 16,
        }}>
          <p style={{ color: colors.dangerText, fontSize: 14, margin: 0 }}>
            Failed to load budget data. Make sure your bank accounts are connected and synced.
          </p>
        </div>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <TabBar active={tab} onChange={setTab} />
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      {tab === 'overview'      && <OverviewTab data={budget} />}
      {tab === 'budgets'       && (
        <BudgetsTab
          data={budget}
          onSave={targets =>
            saveBudgetsMutation.mutate(targets)
          }
        />
      )}
      {tab === 'subscriptions' && <SubscriptionsTab data={cf} />}
      {tab === 'cashflow'      && <CashFlowTab data={cf} />}

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
