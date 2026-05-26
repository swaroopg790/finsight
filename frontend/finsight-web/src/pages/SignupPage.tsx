import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2,
} from 'lucide-react'
import api from '../lib/api'
import { colors, radius, shadow } from '../lib/tokens'

// ── Password strength ─────────────────────────────────────────────────────────
type Strength = 'none' | 'weak' | 'fair' | 'strong'

function getStrength(pwd: string): Strength {
  if (!pwd) return 'none'
  let score = 0
  if (pwd.length >= 8)  score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return 'weak'
  if (score <= 3) return 'fair'
  return 'strong'
}

const STRENGTH_META: Record<Strength, { label: string; color: string; bars: number }> = {
  none:   { label: '',        color: colors.border,   bars: 0 },
  weak:   { label: 'Weak',   color: colors.danger,   bars: 1 },
  fair:   { label: 'Fair',   color: colors.warning,  bars: 2 },
  strong: { label: 'Strong', color: colors.success,  bars: 3 },
}

export default function SignupPage() {
  const navigate = useNavigate()

  // Clear any stale tokens so a returning user can sign up cleanly
  // without a leftover Bearer header triggering a 401 on the register endpoint
  useEffect(() => {
    localStorage.removeItem('finsight_token')
    localStorage.removeItem('finsight_refresh_token')
  }, [])

  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd,         setShowPwd]         = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [error,           setError]           = useState('')
  const [isLoading,       setIsLoading]       = useState(false)

  const strength         = getStrength(password)
  const strengthMeta     = STRENGTH_META[strength]
  const passwordsMatch   = confirmPassword === '' || password === confirmPassword
  const confirmDone      = confirmPassword.length > 0
  const canSubmit        = email && password.length >= 8 && password === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setIsLoading(true)
    try {
      const res = await api.post('/auth/register', { email, password })
      localStorage.setItem('finsight_token',         res.data.token)
      localStorage.setItem('finsight_refresh_token', res.data.refreshToken)
      navigate('/')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? ''
      if (detail.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Sign in instead.')
      } else if (detail.toLowerCase().includes('password')) {
        setError('Password must be at least 8 characters.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     `linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)`,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '24px 16px',
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     420,
        background:   colors.surface,
        borderRadius: radius.xl,
        boxShadow:    shadow.xl,
        overflow:     'hidden',
      }}>

        {/* ── Header band ──────────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.brandDark} 100%)`,
          padding:    '28px 32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width:          36,
              height:         36,
              borderRadius:   radius.md,
              background:     'rgba(255,255,255,0.2)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>
              FinSight
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
            Create your account
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>
            Start tracking your portfolio with AI
          </p>
        </div>

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color={colors.textMuted} style={iconStyle} />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
                onFocus={(e)  => { e.currentTarget.style.borderColor = colors.brand }}
                onBlur={(e)   => { e.currentTarget.style.borderColor = colors.border }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color={colors.textMuted} style={iconStyle} />
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={(e)  => { e.currentTarget.style.borderColor = colors.brand }}
                onBlur={(e)   => { e.currentTarget.style.borderColor = colors.border }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={eyeStyle}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Strength meter */}
          {password.length > 0 && (
            <div style={{ marginBottom: 14, marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1, 2, 3].map((bar) => (
                  <div
                    key={bar}
                    style={{
                      flex:         1,
                      height:       4,
                      borderRadius: 2,
                      background:   strengthMeta.bars >= bar ? strengthMeta.color : colors.border,
                      transition:   'background 0.2s',
                    }}
                  />
                ))}
              </div>
              {strengthMeta.label && (
                <p style={{ margin: 0, fontSize: 11, color: strengthMeta.color, fontWeight: 500 }}>
                  {strengthMeta.label} password
                  {strength === 'weak' && ' — try adding numbers or symbols'}
                </p>
              )}
            </div>
          )}

          {/* Confirm password */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              {confirmDone && (
                passwordsMatch
                  ? <CheckCircle2 size={16} color={colors.success} style={iconStyle} />
                  : <AlertCircle  size={16} color={colors.danger}  style={iconStyle} />
              )}
              {!confirmDone && <Lock size={16} color={colors.textMuted} style={iconStyle} />}
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{
                  ...inputStyle,
                  paddingRight:  44,
                  borderColor:   confirmDone && !passwordsMatch ? colors.danger : colors.border,
                }}
                onFocus={(e)  => {
                  if (!confirmDone || passwordsMatch) e.currentTarget.style.borderColor = colors.brand
                }}
                onBlur={(e)   => {
                  e.currentTarget.style.borderColor =
                    confirmDone && !passwordsMatch ? colors.danger : colors.border
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={eyeStyle}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmDone && !passwordsMatch && (
              <p style={{ margin: '5px 0 0', fontSize: 12, color: colors.dangerText }}>
                Passwords don't match
              </p>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              background:   colors.dangerBg,
              border:       `1px solid #fca5a5`,
              borderRadius: radius.md,
              padding:      '10px 14px',
              marginBottom: 16,
              fontSize:     13,
              color:        colors.dangerText,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>
                {error}
                {error.includes('already exists') && (
                  <>
                    {' '}
                    <Link to="/login" style={{ color: colors.brand, fontWeight: 600, textDecoration: 'underline' }}>
                      Sign in
                    </Link>
                  </>
                )}
              </span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || isLoading}
            style={{
              width:          '100%',
              padding:        '13px 20px',
              background:     !canSubmit || isLoading ? '#e2e8f0' : colors.brand,
              color:          !canSubmit || isLoading ? colors.textMuted : '#fff',
              border:         'none',
              borderRadius:   radius.md,
              fontSize:       15,
              fontWeight:     600,
              cursor:         !canSubmit || isLoading ? 'not-allowed' : 'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            8,
              transition:     'background 0.15s',
              minHeight:      48,
              letterSpacing:  '-0.2px',
              boxShadow:      canSubmit && !isLoading ? `0 2px 8px ${colors.brand}40` : 'none',
            }}
            onMouseEnter={(e) => { if (canSubmit && !isLoading) e.currentTarget.style.background = colors.brandDark }}
            onMouseLeave={(e) => { if (canSubmit && !isLoading) e.currentTarget.style.background = colors.brand }}
          >
            {isLoading ? 'Creating account…' : (
              <>Create account <ArrowRight size={16} /></>
            )}
          </button>

          {/* Sign in link */}
          <p style={{ textAlign: 'center', fontSize: 13, color: colors.textMuted, marginTop: 16, marginBottom: 0 }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{ color: colors.brand, fontWeight: 600, textDecoration: 'none' }}
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

// ── Shared input styles ───────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      12,
  fontWeight:    600,
  color:         colors.textSecondary,
  marginBottom:  6,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '12px 14px 12px 38px',
  borderRadius: radius.md,
  border:       `1.5px solid ${colors.border}`,
  fontSize:     16,       // prevents iOS zoom
  fontFamily:   'inherit',
  color:        colors.text,
  outline:      'none',
  transition:   'border-color 0.15s',
  background:   '#fafafa',
}

const iconStyle: React.CSSProperties = {
  position:       'absolute',
  left:           13,
  top:            '50%',
  transform:      'translateY(-50%)',
  pointerEvents:  'none',
}

const eyeStyle: React.CSSProperties = {
  position:       'absolute',
  right:          12,
  top:            '50%',
  transform:      'translateY(-50%)',
  background:     'none',
  border:         'none',
  cursor:         'pointer',
  color:          colors.textMuted,
  display:        'flex',
  alignItems:     'center',
  padding:        4,
}
