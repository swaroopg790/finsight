import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Edit2, X, Check, Sliders,
  TrendingUp, Sparkles, Target,
} from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { cn }            from '../lib/utils'

// ── API types ─────────────────────────────────────────────────────────────────

interface GoalProjection {
  successProbability:  number
  p10Final:            number
  p25Final:            number
  p50Final:            number
  p75Final:            number
  p90Final:            number
  yearlyBands:         string
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
  { value: 'RETIREMENT',     label: 'Retirement',    emoji: '🏖️' },
  { value: 'EMERGENCY_FUND', label: 'Emergency Fund', emoji: '🛡️' },
  { value: 'HOME_PURCHASE',  label: 'Home Purchase',  emoji: '🏡' },
  { value: 'COLLEGE',        label: 'College Fund',   emoji: '🎓' },
  { value: 'WEDDING',        label: 'Wedding',        emoji: '💍' },
  { value: 'CUSTOM',         label: 'Custom Goal',    emoji: '⭐' },
]

const DEFAULT_RETURNS: Record<string, number> = {
  RETIREMENT:     0.07,
  EMERGENCY_FUND: 0.045,
  HOME_PURCHASE:  0.05,
  COLLEGE:        0.065,
  WEDDING:        0.04,
  CUSTOM:         0.06,
}

const DEFAULT_VOLS: Record<string, number> = {
  RETIREMENT:     0.12,
  EMERGENCY_FUND: 0.02,
  HOME_PURCHASE:  0.08,
  COLLEGE:        0.11,
  WEDDING:        0.03,
  CUSTOM:         0.10,
}

// ── Formatting ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct  = (v: number) => `${(v * 100).toFixed(1)}%`
const shortFmt = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`
  return fmt.format(v)
}

// ── Success probability helpers ───────────────────────────────────────────────
function probColorClass(p: number) {
  if (p >= 0.75) return 'text-emerald-400'
  if (p >= 0.50) return 'text-amber-400'
  return 'text-red-400'
}
function probBgClass(p: number) {
  if (p >= 0.75) return 'bg-emerald-500/10 border-emerald-500/30'
  if (p >= 0.50) return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-red-500/10 border-red-500/30'
}
function probLabel(p: number): string {
  if (p >= 0.80) return 'On Track'
  if (p >= 0.60) return 'Possible'
  if (p >= 0.40) return 'At Risk'
  return 'Off Track'
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, colorClass }: {
  label: string; value: string; sub?: string; colorClass?: string
}) {
  return (
    <div className="glass rounded-2xl p-4 min-w-0">
      <p className="label-xs mb-1.5">{label}</p>
      <p className={cn('text-xl font-bold font-nums tracking-tight', colorClass ?? 'text-slate-100')}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
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
    return (
      <div className="text-slate-500 text-sm text-center py-6">No projection data</div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={bands} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="p90grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="p50grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis
          tickFormatter={shortFmt}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={64}
        />
        <Tooltip
          formatter={(v) => [shortFmt(Number(v)), '']}
          contentStyle={{
            background: '#0f0f1e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            fontSize: 12,
            color: '#e2e8f0',
          }}
        />
        <Area type="monotone" dataKey="p90" stroke="none"     fill="url(#p90grad)" name="Best (P90)" />
        <Area type="monotone" dataKey="p75" stroke="#818cf8"  strokeWidth={1} fill="url(#p50grad)" strokeDasharray="4 2" name="Good (P75)" />
        <Area type="monotone" dataKey="p50" stroke="#4f46e5"  strokeWidth={2.5} fill="none" name="Median (P50)" />
        <Area type="monotone" dataKey="p25" stroke="#818cf8"  strokeWidth={1} fill="none" strokeDasharray="4 2" name="Weak (P25)" />
        <Area type="monotone" dataKey="p10" stroke="#ef4444"  strokeWidth={1} fill="none" strokeDasharray="2 3" name="Worst (P10)" />
        <ReferenceLine y={goal.targetAmount} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={2}
          label={{ value: `Target ${shortFmt(goal.targetAmount)}`, position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── What-If Panel ─────────────────────────────────────────────────────────────

function WhatIfPanel({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const [contrib, setContrib] = useState(goal.monthlyContribution)
  const [retPct,  setRetPct]  = useState(goal.expectedReturnPct * 100)
  const [current, setCurrent] = useState(goal.currentValue)

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
  const delta   = data?.probabilityDelta   ?? null

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Sliders size={16} className="text-indigo-400" />
          What-If Simulator
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-4 mb-5">
        {/* Monthly contribution */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Monthly Contribution</span>
            <span className="text-white font-bold font-nums">{fmt.format(contrib)}</span>
          </div>
          <input type="range" min={0} max={5000} step={50} value={contrib}
            onChange={e => setContrib(Number(e.target.value))}
            className="w-full accent-indigo-600 h-1 cursor-pointer" />
          <div className="flex justify-between text-slate-600 text-[11px] mt-1">
            <span>$0</span><span>$5,000/mo</span>
          </div>
        </div>

        {/* Expected return */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Expected Annual Return</span>
            <span className="text-white font-bold font-nums">{retPct.toFixed(1)}%</span>
          </div>
          <input type="range" min={1} max={15} step={0.5} value={retPct}
            onChange={e => setRetPct(Number(e.target.value))}
            className="w-full accent-indigo-600 h-1 cursor-pointer" />
          <div className="flex justify-between text-slate-600 text-[11px] mt-1">
            <span>1%</span><span>15%</span>
          </div>
        </div>

        {/* Current value */}
        <div>
          <label className="label-xs mb-1.5 block">Current Saved Amount</label>
          <input
            type="number"
            value={current}
            min={0}
            onChange={e => setCurrent(Number(e.target.value))}
            className="input-field"
          />
        </div>
      </div>

      <button
        onClick={() => mutate()}
        disabled={isPending}
        className={cn('btn-primary w-full justify-center mb-4', isPending && 'opacity-70')}
      >
        {isPending ? 'Simulating…' : 'Run Simulation'}
      </button>

      {data && (
        <div className="glass-sm rounded-xl p-4 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="label-xs mb-1">Baseline</p>
            <p className={cn('text-xl font-bold font-nums', probColorClass(basePct))}>{pct(basePct)}</p>
          </div>
          <div className="text-center">
            <p className="label-xs mb-1">New Odds</p>
            <p className={cn('text-xl font-bold font-nums', probColorClass(newPct ?? 0))}>{pct(newPct ?? 0)}</p>
          </div>
          <div className="text-center">
            <p className="label-xs mb-1">Change</p>
            <p className={cn('text-xl font-bold font-nums', (delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {(delta ?? 0) >= 0 ? '+' : ''}{pct(delta ?? 0)}
            </p>
          </div>
          <div className="col-span-3 text-center mt-1">
            <span className="text-slate-400 text-xs">Median outcome: </span>
            <span className="text-white text-xs font-bold font-nums">{shortFmt(data.p50Final)}</span>
            <span className="text-slate-500 text-xs"> ({shortFmt(data.p10Final)} – {shortFmt(data.p90Final)} range)</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, onDelete, onEdit }: {
  goal: Goal
  onDelete: (id: string) => void
  onEdit:   (goal: Goal) => void
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [showWhatIf,  setShowWhatIf]  = useState(false)

  const prob   = goal.projection?.successProbability ?? 0
  const progrW = Math.round(goal.progressFraction * 100)

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0">{goal.emoji}</span>
            <div className="min-w-0">
              <p className="text-white font-bold text-base truncate">{goal.name}</p>
              <p className="text-slate-500 text-xs">{goal.goalTypeLabel} · by {new Date(goal.targetDate).getFullYear()}</p>
            </div>
          </div>
          {goal.projection && (
            <div className={cn('shrink-0 text-center rounded-xl px-3 py-1.5 border', probBgClass(prob))}>
              <p className={cn('text-lg font-extrabold font-nums leading-none', probColorClass(prob))}>
                {pct(prob)}
              </p>
              <p className={cn('text-[10px] font-bold uppercase tracking-wide', probColorClass(prob))}>
                {probLabel(prob)}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-nums">
            <span>{shortFmt(goal.currentValue)} saved</span>
            <span>Target: {shortFmt(goal.targetAmount)}</span>
          </div>
          <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progrW}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn('h-full rounded-full', progrW >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
            />
          </div>
          <p className="text-slate-500 text-xs mt-1.5">
            {progrW}% of goal · {goal.yearsLeft} year{goal.yearsLeft !== 1 ? 's' : ''} left · {shortFmt(goal.monthlyContribution)}/mo
          </p>
        </div>

        {/* Action row */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150',
              expanded
                ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400'
                : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-300'
            )}
          >
            <TrendingUp size={12} /> {expanded ? 'Hide Chart' : 'View Projection'}
          </button>
          <button
            onClick={() => { setShowWhatIf(!showWhatIf); setExpanded(true) }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150',
              showWhatIf
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-300'
            )}
          >
            <Sliders size={12} /> What-If
          </button>
          <button
            onClick={() => onEdit(goal)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-300 transition-colors"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white/[0.03] border-white/[0.08] text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Expanded Monte Carlo + What-If */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.04] px-4 pb-5 pt-4 flex flex-col gap-4">
              {goal.projection && (
                <div>
                  <p className="text-slate-500 text-xs mb-2">
                    Monte Carlo projection · {goal.projection.simulationPaths.toLocaleString()} simulations
                  </p>
                  <MonteCarloChart goal={goal} />
                  <div className="flex gap-4 mt-3 flex-wrap">
                    {([
                      ['P10 (Worst)',  'p10Final', 'text-red-400'],
                      ['P50 (Median)', 'p50Final', 'text-indigo-400'],
                      ['P90 (Best)',   'p90Final', 'text-emerald-400'],
                    ] as const).map(([label, key, cls]) => (
                      <div key={key} className="text-center">
                        <p className="text-slate-500 text-xs">{label}</p>
                        <p className={cn('text-sm font-bold font-nums', cls)}>
                          {shortFmt(goal.projection![key as keyof GoalProjection] as number)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {showWhatIf && (
                <WhatIfPanel goal={goal} onClose={() => setShowWhatIf(false)} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Goal Form ─────────────────────────────────────────────────────────────────

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

function GoalForm({ initial, onSave, onCancel, isSaving }: {
  initial?:  Goal | null
  onSave:    (data: GoalFormData) => void
  onCancel:  () => void
  isSaving:  boolean
}) {
  const [form, setForm] = useState<GoalFormData>(() =>
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
  const [parsing,  setParsing] = useState(false)

  const set = useCallback((k: keyof GoalFormData, v: string) =>
    setForm(f => ({ ...f, [k]: v })), [])

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

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-white font-bold text-base mb-5">
        {initial ? '✏️ Edit Goal' : '🎯 New Goal'}
      </p>

      {/* AI Chat Input */}
      {!initial && (
        <div className="bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold mb-2.5">
            <Sparkles size={12} /> Tell Claude your goal in plain English
          </div>
          <div className="flex gap-2">
            <input
              value={nlpText}
              onChange={e => setNlpText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleParse()}
              placeholder='e.g. "I want to retire at 58 with $2M" or "Save $500k for a house by 2031"'
              className="input-field flex-1 text-sm"
            />
            <button
              onClick={handleParse}
              disabled={parsing || !nlpText.trim()}
              className={cn('btn-primary px-4 whitespace-nowrap', (parsing || !nlpText.trim()) && 'opacity-60 cursor-not-allowed')}
            >
              {parsing ? '…' : '✨ Parse'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Goal name */}
        <div className="sm:col-span-2">
          <label className="label-xs mb-1.5 block">Goal Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Retire with $2M" className="input-field" />
        </div>

        {/* Goal type */}
        <div>
          <label className="label-xs mb-1.5 block">Goal Type</label>
          <select value={form.goalType} onChange={e => handleGoalTypeChange(e.target.value)}
            className="input-field">
            {GOAL_TYPES.map(g => (
              <option key={g.value} value={g.value}>{g.emoji} {g.label}</option>
            ))}
          </select>
        </div>

        {/* Target amount */}
        <div>
          <label className="label-xs mb-1.5 block">Target Amount ($)</label>
          <input type="number" value={form.targetAmount}
            onChange={e => set('targetAmount', e.target.value)}
            placeholder="2000000" min={1} className="input-field font-nums" />
        </div>

        {/* Target date */}
        <div>
          <label className="label-xs mb-1.5 block">Target Date</label>
          <input type="date" value={form.targetDate}
            onChange={e => set('targetDate', e.target.value)}
            className="input-field" />
        </div>

        {/* Current value */}
        <div>
          <label className="label-xs mb-1.5 block">Current Saved ($)</label>
          <input type="number" value={form.currentValue}
            onChange={e => set('currentValue', e.target.value)}
            placeholder="0" min={0} className="input-field font-nums" />
        </div>

        {/* Monthly contribution */}
        <div>
          <label className="label-xs mb-1.5 block">Monthly Contribution ($)</label>
          <input type="number" value={form.monthlyContribution}
            onChange={e => set('monthlyContribution', e.target.value)}
            placeholder="500" min={0} className="input-field font-nums" />
        </div>

        {/* Expected return */}
        <div>
          <label className="label-xs mb-1.5 block">Expected Annual Return (%)</label>
          <input type="number" value={form.expectedReturnPct}
            onChange={e => set('expectedReturnPct', e.target.value)}
            placeholder="7" min={0} max={30} step={0.5} className="input-field font-nums" />
        </div>

        {/* Volatility */}
        <div>
          <label className="label-xs mb-1.5 block">Annual Volatility (%)</label>
          <input type="number" value={form.volatilityPct}
            onChange={e => set('volatilityPct', e.target.value)}
            placeholder="12" min={0} max={50} step={0.5} className="input-field font-nums" />
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <label className="label-xs mb-1.5 block">Notes (optional)</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Any context about this goal…"
            rows={2}
            className="input-field resize-none" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 mt-5">
        <button onClick={onCancel} className="btn-ghost text-sm px-4 py-2">
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={isSaving || !form.name || !form.targetAmount || !form.targetDate}
          className={cn('btn-primary', (isSaving || !form.name || !form.targetAmount || !form.targetDate) && 'opacity-60 cursor-not-allowed')}
        >
          <Check size={14} />
          {isSaving ? 'Saving…' : initial ? 'Update Goal' : 'Create & Simulate'}
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

  const { data: goals = [], isLoading, isError } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn:  () => api.get('/goals').then(r => r.data),
  })

  const createMutation = useMutation<Goal, Error, GoalFormData>({
    mutationFn: (form) => api.post<Goal>('/goals', formToPayload(form)).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowForm(false) },
  })

  const updateMutation = useMutation<Goal, Error, { id: string; form: GoalFormData }>({
    mutationFn: ({ id, form }) => api.put<Goal>(`/goals/${id}`, formToPayload(form)).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['goals'] }); setEditingGoal(null) },
  })

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(`/goals/${id}`).then(() => {}),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })

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

  const handleSaveNew  = (form: GoalFormData) => createMutation.mutate(form)
  const handleSaveEdit = (form: GoalFormData) => {
    if (editingGoal) updateMutation.mutate({ id: editingGoal.id, form })
  }
  const handleDelete = (id: string) => {
    if (confirm('Delete this goal?')) deleteMutation.mutate(id)
  }

  // Summary stats
  const totalSaved   = goals.reduce((s, g) => s + g.currentValue, 0)
  const totalTarget  = goals.reduce((s, g) => s + g.targetAmount, 0)
  const avgProb      = goals.length > 0
    ? goals.reduce((s, g) => s + (g.projection?.successProbability ?? 0), 0) / goals.length
    : 0
  const totalMonthly = goals.reduce((s, g) => s + g.monthlyContribution, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Target size={15} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Goal-Based Planning</h1>
          </div>
          <p className="text-slate-500 text-sm ml-11">
            Monte Carlo projections · {goals.length} active goal{goals.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingGoal(null) }}
          className="btn-primary shrink-0"
        >
          <Plus size={15} /> New Goal
        </button>
      </motion.div>

      {/* Summary stats */}
      {goals.length > 0 && (
        <div className={cn('grid gap-3 mb-6', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
          <StatCard
            label="Total Saved"
            value={shortFmt(totalSaved)}
            sub={`of ${shortFmt(totalTarget)} target`}
          />
          <StatCard
            label="Avg Success Odds"
            value={pct(avgProb)}
            sub={probLabel(avgProb)}
            colorClass={probColorClass(avgProb)}
          />
          <StatCard
            label="Monthly Contributions"
            value={fmt.format(totalMonthly)}
            sub="across all goals"
          />
          <StatCard
            label="Goals"
            value={String(goals.length)}
            sub={`${goals.filter(g => (g.projection?.successProbability ?? 0) >= 0.75).length} on track`}
            colorClass="text-emerald-400"
          />
        </div>
      )}

      {/* Create form */}
      {showForm && !editingGoal && (
        <div className="mb-5">
          <GoalForm
            onSave={handleSaveNew}
            onCancel={() => setShowForm(false)}
            isSaving={createMutation.isPending}
          />
        </div>
      )}

      {/* Edit form */}
      {editingGoal && (
        <div className="mb-5">
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
        <div className="flex flex-col gap-3">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="glass rounded-xl p-5 text-center border-l-2 border-l-red-500">
          <p className="text-red-400 text-sm">Failed to load goals. Check that the backend is running.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && goals.length === 0 && !showForm && (
        <div className="border-2 border-dashed border-white/[0.08] rounded-2xl p-12 text-center bg-white/[0.01]">
          <div className="text-5xl mb-3">🎯</div>
          <p className="text-white text-lg font-bold mb-2">No goals yet</p>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-5">
            Set your first goal and FinSight will run 5,000 Monte Carlo simulations to show your probability of success.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex"
          >
            <Sparkles size={15} /> Create Your First Goal
          </button>
        </div>
      )}

      {/* Goal cards */}
      {!isLoading && goals.length > 0 && (
        <div className="flex flex-col gap-4 stagger-children">
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
    </div>
  )
}
