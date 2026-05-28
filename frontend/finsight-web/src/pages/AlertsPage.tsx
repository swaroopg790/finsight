import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, TrendingDown, Mail, CheckCircle, AlertCircle } from 'lucide-react'
import api                    from '../lib/api'
import { useBreakpoint }      from '../hooks/useBreakpoint'
import { colors, radius, shadow } from '../lib/tokens'

// ── API types ─────────────────────────────────────────────────────────────────
interface AlertPreference {
  alertType:         string  // PORTFOLIO_DROP | WEEKLY_SUMMARY
  enabled:           boolean
  thresholdPct:      number | null
  notificationEmail: string | null
}

interface PutAlertRequest {
  enabled:           boolean
  thresholdPct:      number | null
  notificationEmail: string | null
}

// ── Default values ────────────────────────────────────────────────────────────
const DEFAULT_PREFS: AlertPreference[] = [
  { alertType: 'PORTFOLIO_DROP', enabled: false, thresholdPct: 5, notificationEmail: null },
  { alertType: 'WEEKLY_SUMMARY', enabled: true,  thresholdPct: null, notificationEmail: null },
]

export default function AlertsPage() {
  const queryClient  = useQueryClient()
  const { isMobile } = useBreakpoint()

  const { data: serverPrefs = [], isLoading } = useQuery<AlertPreference[]>({
    queryKey: ['alerts'],
    queryFn:  () => api.get('/alerts/preferences').then((r) => r.data),
    staleTime: 30_000,
  })

  // Merge server prefs with defaults so we always show both card types
  const prefs: AlertPreference[] = DEFAULT_PREFS.map((def) => {
    const server = serverPrefs.find((p) => p.alertType === def.alertType)
    return server ?? def
  })

  const saveMutation = useMutation({
    mutationFn: ({ alertType, body }: { alertType: string; body: PutAlertRequest }) =>
      api.put(`/alerts/preferences/${alertType}`, body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const outerPadding = isMobile ? '16px' : '28px 32px'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: outerPadding }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: isMobile ? 18 : 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: radius.sm,
            background: colors.brandBg, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Bell size={16} color={colors.brand} />
          </div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px', color: colors.text }}>
            Alert Preferences
          </h1>
        </div>
        <p style={{ color: colors.textMuted, margin: 0, fontSize: 13 }}>
          Stay informed about your portfolio — we'll email you when it matters.
          {' '}<span style={{ color: colors.brand }}>Dev mode: emails are logged to console.</span>
        </p>
      </div>

      {isLoading ? (
        <p style={{ color: colors.textMuted, fontSize: 13 }}>Loading preferences…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {prefs.map((pref) => (
            <AlertCard
              key={pref.alertType}
              pref={pref}
              isMobile={isMobile}
              isSaving={saveMutation.isPending}
              onSave={(body) => saveMutation.mutate({ alertType: pref.alertType, body })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Alert card ────────────────────────────────────────────────────────────────
function AlertCard({
  pref, isMobile, isSaving, onSave,
}: {
  pref:     AlertPreference
  isMobile: boolean
  isSaving: boolean
  onSave:   (body: PutAlertRequest) => void
}) {
  const [enabled,   setEnabled]   = useState(pref.enabled)
  const [threshold, setThreshold] = useState<number>(pref.thresholdPct ?? 5)
  const [email,     setEmail]     = useState(pref.notificationEmail ?? '')
  const [saved,     setSaved]     = useState(false)
  const [emailErr,  setEmailErr]  = useState('')

  // Sync when server data arrives
  useEffect(() => {
    setEnabled(pref.enabled)
    setThreshold(pref.thresholdPct ?? 5)
    setEmail(pref.notificationEmail ?? '')
  }, [pref.enabled, pref.thresholdPct, pref.notificationEmail])

  const isDrop    = pref.alertType === 'PORTFOLIO_DROP'

  const title = isDrop ? 'Portfolio Drop Alert' : 'Weekly Portfolio Summary'
  const desc  = isDrop
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
    onSave({
      enabled,
      thresholdPct: isDrop ? threshold : null,
      notificationEmail: email.trim() || null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:      isMobile ? 18 : 24,
      boxShadow:    shadow.sm,
      borderLeft:   `3px solid ${enabled ? colors.brand : colors.border}`,
      transition:   'border-left-color 0.2s',
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: radius.sm,
            background: enabled ? colors.brandBg : colors.surfaceHover,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isDrop
              ? <TrendingDown size={16} color={enabled ? colors.brand : colors.textMuted} />
              : <Mail         size={16} color={enabled ? colors.brand : colors.textMuted} />}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text }}>{title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.textMuted }}>{desc}</p>
          </div>
        </div>

        {/* Toggle switch */}
        <ToggleSwitch checked={enabled} onChange={setEnabled} />
      </div>

      {/* Body — only shown when enabled */}
      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Portfolio drop threshold */}
          {isDrop && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 8 }}>
                Alert me when portfolio drops by&ensp;
                <span style={{ color: colors.brand, fontWeight: 700 }}>{threshold}%</span>
                &ensp;or more
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  style={{
                    flex:        1,
                    accentColor: colors.brand,
                    cursor:      'pointer',
                    height:      4,
                  }}
                />
                <span style={{
                  minWidth:     40,
                  textAlign:    'right',
                  fontSize:     14,
                  fontWeight:   700,
                  color:        colors.brand,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {threshold}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                <span>0.5%</span>
                <span>10%</span>
                <span>20%</span>
              </div>
            </div>
          )}

          {/* Email override */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
              Notification email&ensp;
              <span style={{ fontSize: 11, fontWeight: 400, color: colors.textMuted }}>(leave blank to use your account email)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailErr('') }}
              placeholder="alerts@example.com"
              style={{
                width:        '100%',
                padding:      '10px 12px',
                border:       `1px solid ${emailErr ? colors.danger : colors.border}`,
                borderRadius: radius.sm,
                fontSize:     14,
                color:        colors.text,
                background:   colors.surface,
                outline:      'none',
                fontFamily:   'inherit',
                boxSizing:    'border-box',
                transition:   'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = colors.brand }}
              onBlur={(e)  => { e.target.style.borderColor = emailErr ? colors.danger : colors.border }}
            />
            {emailErr && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> {emailErr}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: enabled ? 18 : 0 }}>
        {saved && (
          <span style={{ fontSize: 13, color: colors.success, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={14} /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            background:   enabled ? colors.brand : colors.surfaceHover,
            color:        enabled ? '#fff' : colors.textMuted,
            border:       'none',
            borderRadius: radius.sm,
            padding:      '9px 20px',
            fontSize:     13,
            fontWeight:   600,
            cursor:       isSaving ? 'wait' : 'pointer',
            transition:   'all 0.15s',
            minHeight:    38,
          }}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width:        44,
        height:       24,
        borderRadius: radius.full,
        background:   checked ? colors.brand : colors.border,
        border:       'none',
        cursor:       'pointer',
        position:     'relative',
        flexShrink:   0,
        transition:   'background 0.2s',
        padding:      0,
      }}
    >
      <span style={{
        position:     'absolute',
        top:          3,
        left:         checked ? 23 : 3,
        width:        18,
        height:       18,
        borderRadius: radius.full,
        background:   '#fff',
        boxShadow:    '0 1px 3px rgba(0,0,0,0.2)',
        transition:   'left 0.2s',
      }} />
    </button>
  )
}
