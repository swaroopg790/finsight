import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess } from 'react-plaid-link'
import { Plus, Link2 } from 'lucide-react'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { colors, radius } from '../lib/tokens'

interface Props {
  onSuccess: () => void
}

/**
 * "Connect Brokerage" button powered by Plaid Link.
 *
 * Flow:
 *   1. Fetches a link_token from the backend  (GET /api/v1/plaid/link-token)
 *   2. Opens the Plaid Link widget with that token
 *   3. On success, POSTs the public_token + institution info to /api/v1/plaid/exchange-token
 *   4. Calls onSuccess() so the parent can invalidate its data queries
 *
 * Sandbox test credentials: username = user_good, password = pass_good
 */
export default function ConnectBrokerage({ onSuccess }: Props) {
  const { isMobile } = useBreakpoint()
  const [linkToken,  setLinkToken]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Fetch link token once on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get('/plaid/link-token')
      .then((res) => { if (!cancelled) setLinkToken(res.data.linkToken) })
      .catch(() => { if (!cancelled) setError('Could not initialise Plaid — check your API keys.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

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

  const { open, ready } = usePlaidLink({
    token:    linkToken,
    onSuccess: onPlaidSuccess,
    onExit:   (err) => { if (err) setError('Plaid Link exited with an error.') },
  })

  const isDisabled = loading || !ready || exchanging

  const label = exchanging ? 'Linking…' : loading ? 'Preparing…' : 'Connect Brokerage'

  return (
    <div style={{ width: isMobile ? '100%' : 'auto' }}>
      <button
        onClick={() => open()}
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
        {exchanging ? <Link2 size={14} /> : <Plus size={14} />}
        {label}
      </button>

      {error && (
        <p style={{ color: colors.dangerText, fontSize: 13, marginTop: 8, marginBottom: 0 }}>
          {error}
        </p>
      )}
    </div>
  )
}
