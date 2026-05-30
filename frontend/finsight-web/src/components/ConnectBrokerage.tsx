import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess } from 'react-plaid-link'
import { Plus, Link2, FlaskConical } from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { colors, radius } from '../lib/tokens'

interface Props {
  onSuccess: () => void
}

/**
 * "Connect Brokerage" button powered by Plaid Link.
 *
 * Two modes:
 *  - REAL mode  (PLAID_MODE=sandbox): opens the real Plaid Link widget.
 *                                     Sandbox creds: user_good / pass_good
 *  - MOCK mode  (PLAID_MODE=mock):    backend returns a link-mock-* token;
 *                                     skips Plaid Link entirely and POSTs a
 *                                     synthetic public token straight to
 *                                     exchange-token. No Plaid credentials needed.
 *
 * Flow:
 *   1. GET /plaid/link-token  →  { linkToken }
 *   2a. Mock token → direct POST /plaid/exchange-token (no widget)
 *   2b. Real token → open Plaid Link widget → on success POST /plaid/exchange-token
 *   3. onSuccess() triggers parent query invalidation
 */
export default function ConnectBrokerage({ onSuccess }: Props) {
  const { isMobile } = useBreakpoint()
  const [linkToken,  setLinkToken]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // A mock token is issued by the backend when PLAID_MODE=mock (no real Plaid creds needed)
  const isMockToken = linkToken?.startsWith('link-mock-') ?? false

  // Fetch link token once on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get('/plaid/link-token')
      .then((res) => { if (!cancelled) setLinkToken(res.data.linkToken) })
      .catch(() => { if (!cancelled) setError('Could not initialise Plaid — check backend logs.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ── Mock path: skip Plaid Link, exchange a synthetic token directly ──────────
  const connectMock = useCallback(() => {
    setExchanging(true)
    setError(null)
    api
      .post('/plaid/exchange-token', {
        publicToken:     'mock-public-token-' + Date.now(),
        institutionId:   'mock-ins-0',
        institutionName: 'Mock Brokerage (Dev)',
      })
      .then(() => onSuccess())
      .catch(() => setError('Mock connect failed — check backend logs.'))
      .finally(() => setExchanging(false))
  }, [onSuccess])

  // ── Real Plaid path ──────────────────────────────────────────────────────────
  const onPlaidSuccess: PlaidLinkOnSuccess = useCallback(
    (publicToken, metadata) => {
      setExchanging(true)
      setError(null)
      api
        .post('/plaid/exchange-token', {
          publicToken,
          institutionId:   metadata.institution?.institution_id ?? 'unknown',
          institutionName: metadata.institution?.name           ?? 'Unknown Institution',
        })
        .then(() => onSuccess())
        .catch(() => setError('Failed to link account. Please try again.'))
        .finally(() => setExchanging(false))
    },
    [onSuccess],
  )

  // usePlaidLink is always called (Rules of Hooks).
  // In mock mode we pass null so the Plaid SDK never tries to load/validate the token.
  const { open, ready } = usePlaidLink({
    token:     isMockToken ? null : linkToken,
    onSuccess: onPlaidSuccess,
    onExit:    (err) => { if (err) setError('Plaid Link exited with an error.') },
  })

  // ── Derived state ────────────────────────────────────────────────────────────
  const isDisabled = loading || exchanging || (!isMockToken && !ready)

  const label = exchanging ? 'Linking…' : loading ? 'Preparing…' : 'Connect Brokerage'

  const handleClick = () => {
    if (isMockToken) connectMock()
    else             open()
  }

  return (
    <div style={{ width: isMobile ? '100%' : 'auto' }}>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            7,
          padding:        '10px 20px',
          minHeight:      44,
          width:          isMobile ? '100%' : 'auto',
          background:     isDisabled ? '#e2e8f0' : colors.brand,
          color:          isDisabled ? colors.textMuted : '#fff',
          border:         'none',
          borderRadius:   radius.md,
          fontSize:       14,
          fontWeight:     600,
          cursor:         isDisabled ? 'not-allowed' : 'pointer',
          transition:     'background 0.15s, transform 0.1s',
          boxShadow:      isDisabled ? 'none' : `0 2px 8px ${colors.brand}40`,
          letterSpacing:  '-0.2px',
        }}
        onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.background = colors.brandDark }}
        onMouseLeave={(e) => { if (!isDisabled) e.currentTarget.style.background = colors.brand }}
      >
        {exchanging
          ? <Link2      size={14} />
          : isMockToken
          ? <FlaskConical size={14} />
          : <Plus       size={14} />}
        {label}
      </button>

      {/* Dev-mode hint */}
      {isMockToken && !error && !exchanging && (
        <p style={{
          margin: '6px 0 0', fontSize: 11,
          color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <FlaskConical size={11} color={colors.brand} />
          Dev mode — loads synthetic portfolio data instantly
        </p>
      )}

      {error && (
        <p style={{ color: colors.dangerText, fontSize: 13, marginTop: 8, marginBottom: 0 }}>
          {error}
        </p>
      )}
    </div>
  )
}
