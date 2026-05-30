import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Plus, Trash2, Edit2, X, Check, Sliders,
  TrendingUp, Sparkles, RotateCcw,
} from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { colors, radius, shadow } from '../lib/tokens'

// ── API types ─────────────────────────────────────────────────────────────────

interface GoalProjection {
  successProbability:  number
  p10Final:            number
  p25Final:            number
  p50Final:            number
  p75Final:            number
  p90Final:            number
  yearlyBands:         string  // JSON
  simulationPaths:     number
  computedAt:          string
}

interface Goal {
  id:                  string
  name:                string
  goalType:            string
  goalTypeLabel:       string
  emoji:               string
  targetAmount:        number
  targetDate:          string
  currentValue:        number
  monthlyContribution: number
  expectedReturnPct:   number
  volatilityPct:       number
  notes:               string | null
  progressFraction:    number
  yearsLeft:           number
  daysLeft:            number
  projection:          GoalProjection | null
  createdAt:           string
}

interface ParseGoalResponse {
  success:             boolean
  name:                string | null
  goalType:            string | null
  goalTypeLabel:       string | null
  emoji:               string | null
  targetAmount:        number | null
  targetDate:          string | null
  monthlyContribution: number | null
}

interface WhatIfResponse {
  successProbability:  number
  baselineProbability: number
  probabilityDelta:    number
  p50Final:            number
  p10Final:            number
  p90Final:            number
}

interface YearlyBand {
  year: number
  p10:  number
  p25:  number
  p50:  number
  p75:  number
  p90:  number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GOAL_TYPES = [
  { value: 'RETIREMENT',    label: 'Retirement',    emoji: '🏖️' },
  { value: 'EMERGENCY_FUND', label: 'Emergency Fund', emoji: '🛡️' },
  { value: 'HOME_PURCHASE', label: 'Home Purchase',  emoji: '🏡' },
  { value: 'COLLEGE',       label: 'College Fund',   emoji: '🎓' },
  { value: 'WEDDING',       label: 'Wedding',        emoji: '💍' },
  { value: 'CUSTOM',        label: 'Custom Goal',    emoji: '⭐' },
]

const DEFAULT_RETURNS: Record<string, number> = {
  RETIREMENT:    0.07,
  EMERGENCY_FUND: 0.045,
  HOME_PURCHASE: 0.05,
  COLLEGE:       0.065,
  WEDDING:       0.04,
  CUSTOM:        0.06,
}

const DEFAULT_VOLS: Record<string, number> = {
  RETIREMENT:    0.12,
  EMERGENCY_FUND: 0.02,
  HOME_PURCHASE: 0.08,
  COLLEGE:       0.11,
  WEDDING:       0.03,
  CUSTOM:        0.10,
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct  = (v: number) => `${(v * 100).toFixed(1)}%`
const shortFmt = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`
  return fmt.format(v)
}

// ── Success probability colour ────────────────────────────────────────────────
function probColor(p: number): string {
  if (p >= 0.75) return '#16a34a'
  if (p >= 0.50) return '#d97706'
  return '#dc2626'
}

function probLabel(p: number): string {
  if (p >= 0.80) return 'On Track'
  if (p >= 0.60) return 'Possible'
  if (p >= 0.40) return 'At Risk'
  return 'Off Track'
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
  color?: string
}
function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <div style={{
      background: colors.surface,
      border:     `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:    '16px 20px',
      boxShadow:  shadow.sm,
      minWidth:   0,
    }}>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? colors.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Monte Carlo chart ─────────────────────────────────────────────────────────

function MonteCarloChart({ goal }: { goal: Goal }) {
  const bands: YearlyBand[] = (() => {
    try { return JSON.parse(goal.projection?.yearlyBands ?? '[]') }
    catch { return [] }
  })()

  if (bands.length === 0) {
    return <div style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: 24 }}>No projection data</div>
  }

  const targetLine = goal.targetAmount

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={bands} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="p90grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02}/>
          </linearGradient>
          <linearGradient id="p50grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35}/>
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: colors.textMuted }} />
        <YAxis
          tickFormatter={shortFmt}
          tick={{ fontSize: 11, fill: colors.textMuted }}
          width={64}
        />
        <Tooltip
          formatter={(v) => [shortFmt(Number(v)), '']}
          contentStyle={{
            background: colors.surface,
            border:     `1px solid ${colors.border}`,
            borderRadius: radius.md,
            fontSize:   12,
          }}
        />
        {/* Confidence bands: p10–p90 (wide), p25–p75 (medium), p50 (median) */}
        <Area type="monotone" dataKey="p90" stroke="none" fill="url(#p90grad)" name="Best (P90)" />
        <Area type="monotone" dataKey="p75" stroke="#818cf8" strokeWidth={1} fill="url(#p50grad)" strokeDasharray="4 2" name="Good (P75)" />
        <Area type="monotone" dataKey="p50" stroke="#4f46e5" strokeWidth={2.5} fill="none" name="Median (P50)" />
        <Area type="monotone" dataKey="p25" stroke="#818cf8" strokeWidth={1} fill="none" strokeDasharray="4 2" name="Weak (P25)" />
        <Area type="monotone" dataKey="p10" stroke="#dc2626" strokeWidth={1} fill="none" strokeDasharray="2 3" name="Worst (P10)" />
        <ReferenceLine y={targetLine} stroke="#dc2626" strokeDasharray="6 3" strokeWidth={2}
          label={{ value: `Target ${shortFmt(targetLine)}`, position: 'insideTopRight', fontSize: 11, fill: '#dc2626' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── What-If Panel ─────────────────────────────────────────────────────────────

function WhatIfPanel({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const [contrib, setContrib]     = useState(goal.monthlyContribution)
  const [retPct, setRetPct]       = useState(goal.expectedReturnPct * 100)
  const [current, setCurrent]     = useState(goal.currentValue)

  const { mutate, data, isPending } = useMutation<WhatIfResponse, Error, void>({
    mutationFn: () =>
      api.post(`/goals/${goal.id}/whatif`, {
        monthlyContribution: contrib,
        expectedReturnPct:   retPct / 100,
        currentValue:        current,
      }).then(r => r.data),
  })

  const basePct = goal.projection?.successProbability ?? 0
  const newPct  = data?.successProbability ?? null
  const delta   = data?.probabilityDelta ?? null

  return (
    <div style={{
      background: colors.surface,
      border:     `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:    24,
      boxShadow:  shadow.md,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: colors.text }}>
          <Sliders size={18} color="#4f46e5" />
          What-If Simulator
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
        {/* Monthly Contribution slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
            <span>Monthly Contribution</span>
            <span style={{ fontWeight: 700, color: colors.text }}>{fmt.format(contrib)}</span>
          </div>
          <input type="range" min={0} max={5000} step={50} value={contrib}
            onChange={e => setContrib(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4f46e5' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textMuted }}>
            <span>$0</span><span>$5,000/mo</span>
          </div>
        </div>

        {/* Expected Return slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
            <span>Expected Annual Return</span>
            <span style={{ fontWeight: 700, color: colors.text }}>{retPct.toFixed(1)}%</span>
          </div>
          <input type="range" min={1} max={15} step={0.5} value={retPct}
            onChange={e => setRetPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4f46e5' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textMuted }}>
            <span>1%</span><span>15%</span>
          </div>
        </div>

        {/* Current Value */}
        <div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>Current Saved Amount</div>
          <input type="number" value={current} min={0}
            onChange={e => setCurrent(Number(e.target.value))}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: radius.sm,
              border: `1px solid ${colors.border}`, background: colors.pageBg,
              color: colors.text, fontSize: 14, boxSizing: 'border-box',
            }} />
        </div>
      </div>

      <button
        onClick={() => mutate()}
        disabled={isPending}
        style={{
          width: '100%', padding: '10px 0', background: '#4f46e5', color: '#fff',
          border: 'none', borderRadius: radius.sm, fontWeight: 600, cursor: 'pointer',
          opacity: isPending ? 0.7 : 1, marginBottom: 16,
        }}
      >
        {isPending ? 'Simulating…' : 'Run Simulation'}
      </button>

      {data && (
        <div style={{
          background: colors.pageBg,
          borderRadius: radius.md,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Baseline</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: probColor(basePct) }}>{pct(basePct)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>New Odds</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: probColor(newPct ?? 0) }}>{pct(newPct ?? 0)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Change</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: (delta ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>
              {(delta ?? 0) >= 0 ? '+' : ''}{pct(delta ?? 0)}
            </div>
          </div>
          <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: colors.textSecondary }}>Median outcome: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{shortFmt(data.p50Final)}</span>
            <span style={{ fontSize: 12, color: colors.textMuted }}> ({shortFmt(data.p10Final)} – {shortFmt(data.p90Final)} range)</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onDelete,
  onEdit,
}: {
  goal: Goal
  onDelete: (id: string) => void
  onEdit:   (goal: Goal) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showWhatIf, setShowWhatIf] = useState(false)

  const prob   = goal.projection?.successProbability ?? 0
  const progrW = Math.round(goal.progressFraction * 100)

  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      boxShadow:    shadow.sm,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 28 }}>{goal.emoji}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {goal.name}
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>{goal.goalTypeLabel} · by {new Date(goal.targetDate).getFullYear()}</div>
            </div>
          </div>
          {/* Success probability badge */}
          {goal.projection && (
            <div style={{
              flexShrink: 0,
              textAlign:  'center',
              background: `${probColor(prob)}15`,
              border:     `1px solid ${probColor(prob)}40`,
              borderRadius: radius.md,
              padding:    '6px 12px',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: probColor(prob) }}>
                {pct(prob)}
              </div>
              <div style={{ fontSize: 10, color: probColor(prob), fontWeight: 600, letterSpacing: '0.02em' }}>
                {probLabel(prob)}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.textSecondary, marginBottom: 5 }}>
            <span>{shortFmt(goal.currentValue)} saved</span>
            <span>Target: {shortFmt(goal.targetAmount)}</span>
          </div>
          <div style={{ height: 8, background: colors.pageBg, borderRadius: radius.full, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
            <div style={{
              height:       '100%',
              width:        `${progrW}%`,
              background:   progrW >= 100 ? '#16a34a' : '#4f46e5',
              borderRadius: radius.full,
              transition:   'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
            {progrW}% of goal · {goal.yearsLeft} year{goal.yearsLeft !== 1 ? 's' : ''} left · {shortFmt(goal.monthlyContribution)}/mo contribution
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', fontSize: 12, borderRadius: radius.sm,
              background: expanded ? '#4f46e520' : colors.pageBg,
              border: `1px solid ${expanded ? '#4f46e5' : colors.border}`,
              color: expanded ? '#4f46e5' : colors.textSecondary,
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            <TrendingUp size={13} /> {expanded ? 'Hide Chart' : 'View Projection'}
          </button>
          <button
            onClick={() => { setShowWhatIf(!showWhatIf); setExpanded(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', fontSize: 12, borderRadius: radius.sm,
              background: showWhatIf ? '#d9770615' : colors.pageBg,
              border: `1px solid ${showWhatIf ? '#d97706' : colors.border}`,
              color: showWhatIf ? '#d97706' : colors.textSecondary,
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            <Sliders size={13} /> What-If
          </button>
          <button
            onClick={() => onEdit(goal)}
            style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', fontSize: 12, borderRadius: radius.sm,
              background: colors.pageBg, border: `1px solid ${colors.border}`,
              color: colors.textSecondary, cursor: 'pointer',
            }}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', fontSize: 12, borderRadius: radius.sm,
              background: colors.pageBg, border: `1px solid ${colors.border}`,
              color: colors.danger, cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded Monte Carlo chart + What-If */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${colors.border}`, padding: '0 16px 16px' }}>
          {goal.projection && (
            <div style={{ paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
                Monte Carlo projection · {(goal.projection.simulationPaths).toLocaleString()} simulations
              </div>
              <MonteCarloChart goal={goal} />
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                {([['P10 (Worst)', 'p10Final', '#dc2626'], ['P50 (Median)', 'p50Final', '#4f46e5'], ['P90 (Best)', 'p90Final', '#16a34a']] as const).map(([label, key, color]) => (
                  <div key={key} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: colors.textMuted }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color }}>{shortFmt(goal.projection![key as keyof GoalProjection] as number)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showWhatIf && (
            <div style={{ marginTop: 16 }}>
              <WhatIfPanel goal={goal} onClose={() => setShowWhatIf(false)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Goal Form (create / edit) ─────────────────────────────────────────────────

interface GoalFormData {
  name:                string
  goalType:            string
  targetAmount:        string
  targetDate:          string
  currentValue:        string
  monthlyContribution: string
  expectedReturnPct:   string
  volatilityPct:       string
  notes:               string
}

const emptyForm = (): GoalFormData => ({
  name:                '',
  goalType:            'RETIREMENT',
  targetAmount:        '',
  targetDate:          '',
  currentValue:        '0',
  monthlyContribution: '500',
  expectedReturnPct:   '7',
  volatilityPct:       '12',
  notes:               '',
})

function GoalForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?:  Goal | null
  onSave:    (data: GoalFormData) => void
  onCancel:  () => void
  isSaving:  boolean
}) {
  const [form, setForm]     = useState<GoalFormData>(() =>
    initial
      ? {
          name:                initial.name,
          goalType:            initial.goalType,
          targetAmount:        String(initial.targetAmount),
          targetDate:          initial.targetDate,
          currentValue:        String(initial.currentValue),
          monthlyContribution: String(initial.monthlyContribution),
          expectedReturnPct:   String(initial.expectedReturnPct * 100),
          volatilityPct:       String(initial.volatilityPct * 100),
          notes:               initial.notes ?? '',
        }
      : emptyForm()
  )

  const [nlpText, setNlpText] = useState('')
  const [parsing, setParsing] = useState(false)

  const set = useCallback((k: keyof GoalFormData, v: string) =>
    setForm(f => ({ ...f, [k]: v })), [])

  // When goal type changes, update default return/vol
  const handleGoalTypeChange = (v: string) => {
    set('goalType', v)
    if (!initial) {
      set('expectedReturnPct', String((DEFAULT_RETURNS[v] ?? 0.07) * 100))
      set('volatilityPct',     String((DEFAULT_VOLS[v]     ?? 0.10) * 100))
    }
  }

  const handleParse = async () => {
    if (!nlpText.trim()) return
    setParsing(true)
    try {
      const r = await api.post<ParseGoalResponse>('/goals/parse', { text: nlpText })
      const p = r.data
      if (p.success) {
        if (p.name)                set('name',                p.name)
        if (p.goalType)            handleGoalTypeChange(p.goalType)
        if (p.targetAmount)        set('targetAmount',        String(p.targetAmount))
        if (p.targetDate)          set('targetDate',          p.targetDate)
        if (p.monthlyContribution) set('monthlyContribution', String(p.monthlyContribution))
      }
    } finally {
      setParsing(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    borderRadius: radius.sm, border: `1px solid ${colors.border}`,
    background: colors.pageBg, color: colors.text,
    fontSize: 14, boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: colors.textSecondary, fontWeight: 600,
    display: 'block', marginBottom: 5,
  }

  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:      24,
      boxShadow:    shadow.md,
    }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: colors.text, marginBottom: 20 }}>
        {initial ? '✏️ Edit Goal' : '🎯 New Goal'}
      </div>

      {/* AI Chat Input */}
      {!initial && (
        <div style={{
          background: '#4f46e510',
          border: '1px solid #4f46e530',
          borderRadius: radius.md,
          padding: 14,
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4f46e5', fontWeight: 600, marginBottom: 8 }}>
            <Sparkles size={13} /> Tell Claude your goal in plain English
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={nlpText}
              onChange={e => setNlpText(e.target.value)}
              placeholder='e.g. "I want to retire at 58 with $2M" or "Save $500k for a house by 2031"'
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && handleParse()}
            />
            <button
              onClick={handleParse}
              disabled={parsing || !nlpText.trim()}
              style={{
                padding: '9px 16px', background: '#4f46e5', color: '#fff',
                border: 'none', borderRadius: radius.sm, cursor: 'pointer',
                fontWeight: 600, fontSize: 13, opacity: parsing ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {parsing ? '…' : '✨ Parse'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Goal name */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Goal Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Retire with $2M" style={inputStyle} />
        </div>

        {/* Goal type */}
        <div>
          <label style={labelStyle}>Goal Type</label>
          <select value={form.goalType} onChange={e => handleGoalTypeChange(e.target.value)} style={inputStyle}>
            {GOAL_TYPES.map(g => (
              <option key={g.value} value={g.value}>{g.emoji} {g.label}</option>
            ))}
          </select>
        </div>

        {/* Target amount */}
        <div>
          <label style={labelStyle}>Target Amount ($)</label>
          <input type="number" value={form.targetAmount} onChange={e => set('targetAmount', e.target.value)}
            placeholder="2000000" min={1} style={inputStyle} />
        </div>

        {/* Target date */}
        <div>
          <label style={labelStyle}>Target Date</label>
          <input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)}
            style={inputStyle} />
        </div>

        {/* Current value */}
        <div>
          <label style={labelStyle}>Current Saved ($)</label>
          <input type="number" value={form.currentValue} onChange={e => set('currentValue', e.target.value)}
            placeholder="0" min={0} style={inputStyle} />
        </div>

        {/* Monthly contribution */}
        <div>
          <label style={labelStyle}>Monthly Contribution ($)</label>
          <input type="number" value={form.monthlyContribution} onChange={e => set('monthlyContribution', e.target.value)}
            placeholder="500" min={0} style={inputStyle} />
        </div>

        {/* Expected return */}
        <div>
          <label style={labelStyle}>Expected Annual Return (%)</label>
          <input type="number" value={form.expectedReturnPct} onChange={e => set('expectedReturnPct', e.target.value)}
            placeholder="7" min={0} max={30} step={0.5} style={inputStyle} />
        </div>

        {/* Volatility */}
        <div>
          <label style={labelStyle}>Annual Volatility (%) </label>
          <input type="number" value={form.volatilityPct} onChange={e => set('volatilityPct', e.target.value)}
            placeholder="12" min={0} max={50} step={0.5} style={inputStyle} />
        </div>

        {/* Notes */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Any context about this goal…"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '9px 20px', border: `1px solid ${colors.border}`,
          background: colors.pageBg, color: colors.textSecondary,
          borderRadius: radius.sm, cursor: 'pointer', fontSize: 14,
        }}>
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={isSaving || !form.name || !form.targetAmount || !form.targetDate}
          style={{
            padding: '9px 20px', background: '#4f46e5', color: '#fff',
            border: 'none', borderRadius: radius.sm, cursor: 'pointer',
            fontWeight: 600, fontSize: 14, opacity: isSaving ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Check size={15} /> {isSaving ? 'Saving…' : initial ? 'Update Goal' : 'Create & Simulate'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GoalPage() {
  const { isMobile } = useBreakpoint()
  const qc = useQueryClient()

  const [showForm,    setShowForm]    = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: goals = [], isLoading, isError } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then(r => r.data),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation<Goal, Error, GoalFormData>({
    mutationFn: (form) => api.post<Goal>('/goals', formToPayload(form)).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowForm(false) },
  })

  const updateMutation = useMutation<Goal, Error, { id: string; form: GoalFormData }>({
    mutationFn: ({ id, form }) => api.put<Goal>(`/goals/${id}`, formToPayload(form)).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setEditingGoal(null) },
  })

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(`/goals/${id}`).then(() => {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })

  // ── Form helpers ──────────────────────────────────────────────────────────
  function formToPayload(form: GoalFormData) {
    return {
      name:                form.name,
      goalType:            form.goalType,
      targetAmount:        Number(form.targetAmount),
      targetDate:          form.targetDate,
      currentValue:        Number(form.currentValue) || 0,
      monthlyContribution: Number(form.monthlyContribution) || 0,
      expectedReturnPct:   Number(form.expectedReturnPct) / 100,
      volatilityPct:       Number(form.volatilityPct) / 100,
      notes:               form.notes || null,
    }
  }

  const handleSaveNew = (form: GoalFormData) => createMutation.mutate(form)
  const handleSaveEdit = (form: GoalFormData) => {
    if (editingGoal) updateMutation.mutate({ id: editingGoal.id, form })
  }
  const handleDelete = (id: string) => {
    if (confirm('Delete this goal?')) deleteMutation.mutate(id)
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalSaved = goals.reduce((s, g) => s + g.currentValue, 0)
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const avgProb = goals.length > 0
    ? goals.reduce((s, g) => s + (g.projection?.successProbability ?? 0), 0) / goals.length
    : 0
  const totalMonthly = goals.reduce((s, g) => s + g.monthlyContribution, 0)

  return (
    <div style={{ padding: isMobile ? 16 : 24, maxWidth: 900, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, color: colors.text }}>
            🎯 Goal-Based Planning
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textSecondary }}>
            Monte Carlo projections · {goals.length} active goal{goals.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingGoal(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', background: '#4f46e5', color: '#fff',
            border: 'none', borderRadius: radius.md, cursor: 'pointer',
            fontWeight: 600, fontSize: 14, boxShadow: shadow.sm,
          }}
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      {/* Summary stats */}
      {goals.length > 0 && (
        <div style={{
          display:               'grid',
          gridTemplateColumns:   `repeat(${isMobile ? 2 : 4}, 1fr)`,
          gap:                   12,
          marginBottom:          24,
        }}>
          <StatCard label="Total Saved" value={shortFmt(totalSaved)} sub={`of ${shortFmt(totalTarget)} target`} />
          <StatCard label="Avg Success Odds" value={pct(avgProb)} sub={probLabel(avgProb)} color={probColor(avgProb)} />
          <StatCard label="Monthly Contributions" value={fmt.format(totalMonthly)} sub="across all goals" />
          <StatCard label="Goals" value={String(goals.length)} sub={`${goals.filter(g => (g.projection?.successProbability ?? 0) >= 0.75).length} on track`} color="#16a34a" />
        </div>
      )}

      {/* Create form */}
      {showForm && !editingGoal && (
        <div style={{ marginBottom: 24 }}>
          <GoalForm
            onSave={handleSaveNew}
            onCancel={() => setShowForm(false)}
            isSaving={createMutation.isPending}
          />
        </div>
      )}

      {/* Edit form */}
      {editingGoal && (
        <div style={{ marginBottom: 24 }}>
          <GoalForm
            initial={editingGoal}
            onSave={handleSaveEdit}
            onCancel={() => setEditingGoal(null)}
            isSaving={updateMutation.isPending}
          />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 160, color: colors.textMuted, gap: 10,
        }}>
          <RotateCcw size={20} style={{ animation: 'spin 1s linear infinite' }} />
          Running simulations…
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{
          padding: 20, background: colors.dangerBg, borderRadius: radius.md,
          color: colors.danger, fontSize: 14, textAlign: 'center',
        }}>
          Failed to load goals. Check that the backend is running.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && goals.length === 0 && !showForm && (
        <div style={{
          textAlign:    'center',
          padding:      48,
          background:   colors.surface,
          borderRadius: radius.lg,
          border:       `2px dashed ${colors.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            No goals yet
          </div>
          <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
            Set your first goal and FinSight will run 5,000 Monte Carlo simulations to show your probability of success.
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '12px 24px', background: '#4f46e5', color: '#fff',
              border: 'none', borderRadius: radius.md, cursor: 'pointer',
              fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <Sparkles size={16} /> Create Your First Goal
          </button>
        </div>
      )}

      {/* Goal cards */}
      {!isLoading && goals.length > 0 && (
        <div style={{ display: 'grid', gap: 16 }}>
          {goals.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              onDelete={handleDelete}
              onEdit={(goal) => { setEditingGoal(goal); setShowForm(false) }}
            />
          ))}
        </div>
      )}

      {/* CSS for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
