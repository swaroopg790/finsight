import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bell, TrendingDown, Mail, CheckCircle } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'

// ── API types ─────────────────────────────────────────────────────────────────
interface AlertPreference {
  alertType:         string
  enabled:           boolean
  thresholdPct:      number | null
  notificationEmail: string | null
}
interface PutAlertRequest {
  enabled:           boolean
  thresholdPct:      number | null
  notificationEmail: string | null
}

const DEFAULT_PREFS: AlertPreference[] = [
  { alertType: 'PORTFOLIO_DROP', enabled: false, thresholdPct: 5,    notificationEmail: null },
  { alertType: 'WEEKLY_SUMMARY', enabled: true,  thresholdPct: null, notificationEmail: null },
]

// ── Toggle Switch ──────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
        checked ? 'bg-indigo-600' : 'bg-white/[0.08]'
      )}
    >
      <span className={cn(
        'inline-block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 absolute top-1',
        checked ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  )
}

// ── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({ pref, isSaving, onSave }: {
  pref:     AlertPreference
  isSaving: boolean
  onSave:   (body: PutAlertRequest) => void
}) {
  const [enabled,   setEnabled]   = useState(pref.enabled)
  const [threshold, setThreshold] = useState<number>(pref.thresholdPct ?? 5)
  const [email,     setEmail]     = useState(pref.notificationEmail ?? '')
  const [saved,     setSaved]     = useState(false)
  const [emailErr,  setEmailErr]  = useState('')

  useEffect(() => {
    setEnabled(pref.enabled)
    setThreshold(pref.thresholdPct ?? 5)
    setEmail(pref.notificationEmail ?? '')
  }, [pref.enabled, pref.thresholdPct, pref.notificationEmail])

  const isDrop  = pref.alertType === 'PORTFOLIO_DROP'
  const title   = isDrop ? 'Portfolio Drop Alert' : 'Weekly Portfolio Summary'
  const desc    = isDrop
    ? 'Get notified when your portfolio drops by a set percentage within 24 hours.'
    : 'Receive a weekly email summary every Monday with your portfolio performance.'

  function validate() {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailErr('Enter a valid email address')
      return false
    }
    setEmailErr('')
    return true
  }

  function handleSave() {
    if (!validate()) return
    onSave({ enabled, thresholdPct: isDrop ? threshold : null, notificationEmail: email.trim() || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className={cn(
      'glass rounded-2xl p-5 border-l-2 transition-all duration-200',
      enabled ? 'border-l-indigo-500' : 'border-l-white/[0.06]'
    )}>
      {/* Card header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
            enabled ? 'bg-indigo-500/10' : 'bg-white/[0.04]')}>
            {isDrop
              ? <TrendingDown size={16} className={enabled ? 'text-indigo-400' : 'text-slate-500'} />
              : <Mail         size={16} className={enabled ? 'text-indigo-400' : 'text-slate-500'} />}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{title}</p>
            <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
          </div>
        </div>
        <ToggleSwitch checked={enabled} onChange={setEnabled} />
      </div>

      {/* Settings (visible when enabled) */}
      {enabled && (
        <div className="flex flex-col gap-4 pt-3 border-t border-white/[0.04]">
          {/* Threshold slider */}
          {isDrop && (
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400">Alert me when portfolio drops by</span>
                <span className="text-indigo-400 font-bold font-nums">{threshold}%</span>
              </div>
              <input
                type="range" min={0.5} max={20} step={0.5} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1"
              />
              <div className="flex justify-between text-slate-600 text-2xs mt-1">
                <span>0.5%</span><span>10%</span><span>20%</span>
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="label-xs mb-1.5 block">Notification Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailErr('') }}
              className={cn('input-field', emailErr && 'border-red-500/40')}
            />
            {emailErr && <p className="text-red-400 text-xs mt-1">{emailErr}</p>}
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
                <CheckCircle size={13} /> Saved!
              </span>
            )}
            <button onClick={handleSave} disabled={isSaving}
              className={cn('btn-primary text-xs px-4 py-2', isSaving && 'opacity-70')}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Disabled state hint */}
      {!enabled && (
        <p className="text-slate-600 text-xs mt-1">Enable to configure this alert.</p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const queryClient = useQueryClient()

  const { data: serverPrefs = [], isLoading } = useQuery<AlertPreference[]>({
    queryKey:  ['alerts'],
    queryFn:   () => api.get('/alerts/preferences').then(r => r.data),
    staleTime: 30_000,
  })

  const prefs: AlertPreference[] = DEFAULT_PREFS.map(def => {
    const server = serverPrefs.find(p => p.alertType === def.alertType)
    return server ?? def
  })

  const saveMutation = useMutation({
    mutationFn: ({ alertType, body }: { alertType: string; body: PutAlertRequest }) =>
      api.put(`/alerts/preferences/${alertType}`, body).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alerts'] }) },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Bell size={15} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Alert Preferences</h1>
        </div>
        <p className="text-slate-500 text-sm ml-11">
          Stay informed about your portfolio — we'll email you when it matters.{' '}
          <span className="text-indigo-400">Dev mode: emails are logged to console.</span>
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 stagger-children">
          {prefs.map(pref => (
            <AlertCard
              key={pref.alertType}
              pref={pref}
              isSaving={saveMutation.isPending}
              onSave={body => saveMutation.mutate({ alertType: pref.alertType, body })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
