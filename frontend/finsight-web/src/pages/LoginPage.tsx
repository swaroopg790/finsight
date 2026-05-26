import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import { colors, radius, shadow } from '../lib/tokens'

export default function LoginPage() {
  const navigate    = useNavigate()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      localStorage.setItem('finsight_token',         res.data.token)
      localStorage.setItem('finsight_refresh_token', res.data.refreshToken)
      navigate('/')
    } catch {
      setError('Invalid email or password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:  '100vh',
      background: `linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)`,
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding:    '24px 16px',
    }}>
      {/* Card */}
      <div style={{
        width:        '100%',
        maxWidth:     400,
        background:   colors.surface,
        borderRadius: radius.xl,
        boxShadow:    shadow.xl,
        overflow:     'hidden',
      }}>
        {/* Header band */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.brandDark} 100%)`,
          padding:    '28px 32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width:        36,
              height:       36,
              borderRadius: radius.md,
              background:   'rgba(255,255,255,0.2)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>
              FinSight
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
            Welcome back
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>
            Your AI portfolio copilot
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color={colors.textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width:        '100%',
                  padding:      '12px 14px 12px 38px',
                  borderRadius: radius.md,
                  border:       `1.5px solid ${colors.border}`,
                  fontSize:     16,   // prevents iOS zoom
                  fontFamily:   'inherit',
                  color:        colors.text,
                  outline:      'none',
                  transition:   'border-color 0.15s',
                  background:   '#fafafa',
                }}
                onFocus={(e)  => { e.currentTarget.style.borderColor = colors.brand }}
                onBlur={(e)   => { e.currentTarget.style.borderColor = colors.border }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color={colors.textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width:        '100%',
                  padding:      '12px 14px 12px 38px',
                  borderRadius: radius.md,
                  border:       `1.5px solid ${colors.border}`,
                  fontSize:     16,
                  fontFamily:   'inherit',
                  color:        colors.text,
                  outline:      'none',
                  transition:   'border-color 0.15s',
                  background:   '#fafafa',
                }}
                onFocus={(e)  => { e.currentTarget.style.borderColor = colors.brand }}
                onBlur={(e)   => { e.currentTarget.style.borderColor = colors.border }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display:     'flex',
              alignItems:  'center',
              gap:         8,
              background:  colors.dangerBg,
              border:      `1px solid #fca5a5`,
              borderRadius: radius.md,
              padding:     '10px 14px',
              marginBottom: 16,
              fontSize:    13,
              color:       colors.dangerText,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width:        '100%',
              padding:      '13px 20px',
              background:   isLoading ? colors.brandLight : colors.brand,
              color:        '#fff',
              border:       'none',
              borderRadius: radius.md,
              fontSize:     15,
              fontWeight:   600,
              cursor:       isLoading ? 'not-allowed' : 'pointer',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          8,
              transition:   'background 0.15s, transform 0.1s',
              minHeight:    48,
              letterSpacing: '-0.2px',
            }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = colors.brandDark }}
            onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.background = colors.brand }}
          >
            {isLoading ? (
              'Signing in…'
            ) : (
              <>
                Sign in
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 16 }}>
            Sandbox: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>user_good</code> / <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>pass_good</code>
          </p>
        </form>
      </div>
    </div>
  )
}
