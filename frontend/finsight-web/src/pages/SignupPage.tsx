import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2,
} from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'

// ── Password strength ──────────────────────────────────────────────────────────
type Strength = 'none' | 'weak' | 'fair' | 'strong'

function getStrength(pwd: string): Strength {
  if (!pwd) return 'none'
  let score = 0
  if (pwd.length >= 8)            score++
  if (pwd.length >= 12)           score++
  if (/[A-Z]/.test(pwd))          score++
  if (/[0-9]/.test(pwd))          score++
  if (/[^A-Za-z0-9]/.test(pwd))   score++
  if (score <= 1) return 'weak'
  if (score <= 3) return 'fair'
  return 'strong'
}

const STRENGTH_META: Record<Strength, { label: string; color: string; bars: number }> = {
  none:   { label: '',        color: 'rgba(255,255,255,0.06)', bars: 0 },
  weak:   { label: 'Weak',   color: '#ef4444',                bars: 1 },
  fair:   { label: 'Fair',   color: '#f59e0b',                bars: 2 },
  strong: { label: 'Strong', color: '#10b981',                bars: 3 },
}

export default function SignupPage() {
  const navigate = useNavigate()

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

  const strength       = getStrength(password)
  const strengthMeta   = STRENGTH_META[strength]
  const passwordsMatch = confirmPassword === '' || password === confirmPassword
  const confirmDone    = confirmPassword.length > 0
  const canSubmit      = email && password.length >= 8 && password === confirmPassword

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
        setError('An account with this email already exists.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-indigo-600/[0.07] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-900/[0.12] rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Logo lockup */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-glow">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg tracking-tight leading-none">FinSight</p>
            <p className="text-indigo-400/60 text-2xs tracking-widest uppercase mt-0.5">AI Copilot</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1 tracking-tight">Create account</h1>
          <p className="text-slate-500 text-sm mb-7">Start your AI portfolio journey</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="label-xs mb-2 block">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  className="input-field pl-10" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label-xs mb-2 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input type={showPwd ? 'text' : 'password'} placeholder="Min. 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8} autoComplete="new-password"
                  className="input-field pl-10 pr-11" />
                <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength meter */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map(bar => (
                      <div key={bar} className="flex-1 h-1 rounded-full transition-colors duration-200"
                        style={{ background: strengthMeta.bars >= bar ? strengthMeta.color : 'rgba(255,255,255,0.06)' }} />
                    ))}
                  </div>
                  {strengthMeta.label && (
                    <p className="text-xs" style={{ color: strengthMeta.color }}>
                      {strengthMeta.label} password
                      {strength === 'weak' && ' — try adding numbers or symbols'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="label-xs mb-2 block">Confirm Password</label>
              <div className="relative">
                {confirmDone
                  ? passwordsMatch
                    ? <CheckCircle2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                    : <AlertCircle  size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />
                  : <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                }
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={cn('input-field pl-10 pr-11', confirmDone && !passwordsMatch && 'border-red-500/40')}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmDone && !passwordsMatch && (
                <p className="text-red-400 text-xs mt-1">Passwords don't match</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                <AlertCircle size={14} className="shrink-0" />
                <span>
                  {error}
                  {error.includes('already exists') && (
                    <>{' '}<Link to="/login" className="text-indigo-400 underline font-semibold">Sign in</Link></>
                  )}
                </span>
              </motion.div>
            )}

            {/* Submit */}
            <button type="submit" disabled={!canSubmit || isLoading}
              className={cn('btn-primary w-full mt-1', (!canSubmit || isLoading) && 'opacity-50 cursor-not-allowed')}>
              {isLoading ? 'Creating account…' : (<>Create account <ArrowRight size={15} /></>)}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
