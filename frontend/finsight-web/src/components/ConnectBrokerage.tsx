import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess } from 'react-plaid-link'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'

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
  const [linkToken, setLinkToken]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const [error, setError]           = useState<string | null>(null)

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

  // PlaidLinkOnSuccess is (public_token: string, metadata: PlaidLinkOnSuccessMetadata) => void
  // Must be sync (void, not Promise<void>) — run async work via .then()
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
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err) => {
      if (err) setError('Plaid Link exited with an error.')
    },
  })

  const isDisabled = loading || !ready || exchanging

  return (
    <div style={{ width: isMobile ? '100%' : 'auto' }}>
      <button
        onClick={() => open()}
        disabled={isDisabled}
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          justifyContent: 'center',
          gap:          8,
          padding:      '10px 20px',
          minHeight:    44,               // WCAG touch target
          width:        isMobile ? '100%' : 'auto',
          background:   isDisabled ? '#e0e0e0' : '#000',
          color:        isDisabled ? '#888'    : '#fff',
          border:       'none',
          borderRadius: 8,
          fontSize:     14,
          fontWeight:   600,
          cursor:       isDisabled ? 'not-allowed' : 'pointer',
          transition:   'background 0.15s',
        }}
      >
        {exchanging ? 'Linking…' : loading ? 'Preparing…' : '+ Connect Brokerage'}
      </button>

      {error && (
        <p style={{ color: '#c0392b', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
          {error}
        </p>
      )}
    </div>
  )
}
