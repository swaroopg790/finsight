import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'

export default function LoginPage() {
  const navigate  = useNavigate()
  const { isMobile } = useBreakpoint()

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
      setError('Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth:  400,
      margin:    isMobile ? '40px auto' : '80px auto',
      padding:   '0 24px',
    }}>
      <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, marginBottom: 8 }}>
        FinSight
      </h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Your AI portfolio copilot</p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width:        '100%',
              padding:      '14px',          /* taller for touch */
              borderRadius: 8,
              border:       '1px solid #ddd',
              fontSize:     16,              /* prevents iOS zoom on focus */
            }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width:        '100%',
              padding:      '14px',
              borderRadius: 8,
              border:       '1px solid #ddd',
              fontSize:     16,
            }}
          />
        </div>

        {error && (
          <p style={{ color: 'red', marginBottom: 16, fontSize: 14 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width:        '100%',
            padding:      '14px',           /* min 44px touch target */
            background:   '#000',
            color:        '#fff',
            border:       'none',
            borderRadius: 8,
            fontSize:     16,
            fontWeight:   600,
            cursor:       isLoading ? 'not-allowed' : 'pointer',
            opacity:      isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
