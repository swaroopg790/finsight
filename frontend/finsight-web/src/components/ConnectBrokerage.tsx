import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import type { PlaidLinkOnSuccess } from 'react-plaid-link'
import { Plus, Link2, FlaskConical } from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { cn }            from '../lib/utils'

interface Props { onSuccess: () => void }

/**
 * "Connect Brokerage" button powered by Plaid Link.
 * Two modes:
 *  - REAL mode  (PLAID_MODE=sandbox): opens the real Plaid Link widget.
 *  - MOCK mode  (PLAID_MODE=mock):    backend returns a link-mock-* token;
 *    skips Plaid Link entirely and POSTs a synthetic public token straight
 *    to exchange-token. No Plaid credentials needed.
 */
export default function ConnectBrokerage({ onSuccess }: Props) {
  const { isMobile } = useBreakpoint()
  const [linkToken,  setLinkToken]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const isMockToken = linkToken?.startsWith('link-mock-') ?? false

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get('/plaid/link-token')
      .then(res => { if (!cancelled) setLinkToken(res.data.linkToken) })
      .catch(() => { if (!cancelled) setError('Could not initialise Plaid — check backend logs.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const connectMock = useCallback(() => {
    setExchanging(true)
    setError(null)
    api.post('/plaid/exchange-token', {
      publicToken:     'mock-public-token-' + Date.now(),
      institutionId:   'mock-ins-0',
      institutionName: 'Mock Brokerage (Dev)',
    })
      .then(() => onSuccess())
      .catch(() => setError('Mock connect failed — check backend logs.'))
      .finally(() => setExchanging(false))
  }, [onSuccess])

  const onPlaidSuccess: PlaidLinkOnSuccess = useCallback(
    (publicToken, metadata) => {
      setExchanging(true)
      setError(null)
      api.post('/plaid/exchange-token', {
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
    token:     isMockToken ? null : linkToken,
    onSuccess: onPlaidSuccess,
    onExit:    (err) => { if (err) setError('Plaid Link exited with an error.') },
  })

  const isDisabled = loading || exchanging || (!isMockToken && !ready)
  const label = exchanging ? 'Linking…' : loading ? 'Preparing…' : 'Connect Brokerage'

  const handleClick = () => {
    if (isMockToken) connectMock()
    else             open()
  }

  return (
    <div className={cn(isMobile && 'w-full')}>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={cn('btn-primary', isMobile && 'w-full', isDisabled && 'opacity-50 cursor-not-allowed')}
      >
        {exchanging
          ? <Link2       size={14} />
          : isMockToken
          ? <FlaskConical size={14} />
          : <Plus        size={14} />}
        {label}
      </button>

      {/* Dev-mode hint */}
      {isMockToken && !error && !exchanging && (
        <p className="flex items-center gap-1 text-xs text-slate-600 mt-1.5">
          <FlaskConical size={11} className="text-indigo-400" />
          Dev mode — loads synthetic portfolio data instantly
        </p>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
    </div>
  )
}
