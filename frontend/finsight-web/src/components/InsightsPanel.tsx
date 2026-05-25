import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

interface InsightResponse {
  summary: string
  riskFlags: string[]
  suggestions: string[]
  generatedAt: string
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function InsightsPanel({ hasHoldings }: { hasHoldings: boolean }) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery<InsightResponse>({
    queryKey: ['insights'],
    queryFn:  () => api.get('/insights').then(r => r.data),
    enabled:  hasHoldings,          // only fetch when there are holdings
    staleTime: 29 * 60 * 1000,      // mirrors the 30-min server cache
    retry: false,
  })

  const handleRefresh = async () => {
    // Bust the server cache then refetch
    await api.delete('/insights/cache').catch(() => {})
    queryClient.invalidateQueries({ queryKey: ['insights'] })
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!hasHoldings) {
    return (
      <div style={styles.card}>
        <Header onRefresh={handleRefresh} refreshDisabled />
        <p style={styles.muted}>Connect a brokerage account to unlock AI portfolio analysis.</p>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={styles.card}>
        <Header onRefresh={handleRefresh} refreshDisabled />
        <div style={styles.skeleton}>
          <div style={{ ...styles.skeletonLine, width: '90%' }} />
          <div style={{ ...styles.skeletonLine, width: '75%', marginTop: 8 }} />
          <div style={{ ...styles.skeletonLine, width: '60%', marginTop: 8 }} />
        </div>
        <p style={{ ...styles.muted, marginTop: 12 }}>Analysing your portfolio with Llama 3.3…</p>
      </div>
    )
  }

  // ── Service unavailable ──────────────────────────────────────────────────
  if (isError) {
    const msg = (error as { response?: { status: number } })?.response?.status === 503
      ? 'AI service is offline. Start the AI service and refresh.'
      : 'Could not load insights. Please try again.'
    return (
      <div style={styles.card}>
        <Header onRefresh={handleRefresh} />
        <p style={{ ...styles.muted, color: '#c0392b' }}>{msg}</p>
      </div>
    )
  }

  if (!data) return null

  // ── Insights ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.card}>
      <Header onRefresh={handleRefresh} generatedAt={data.generatedAt} />

      {/* Summary */}
      <p style={styles.summary}>{data.summary}</p>

      {/* Risk Flags */}
      {data.riskFlags?.length > 0 && (
        <section style={styles.section}>
          <p style={styles.sectionLabel}>⚠️ Risk Flags</p>
          <ul style={styles.list}>
            {data.riskFlags.map((flag, i) => (
              <li key={i} style={{ ...styles.listItem, ...styles.flagItem }}>{flag}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Suggestions */}
      {data.suggestions?.length > 0 && (
        <section style={styles.section}>
          <p style={styles.sectionLabel}>💡 Suggestions</p>
          <ul style={styles.list}>
            {data.suggestions.map((s, i) => (
              <li key={i} style={{ ...styles.listItem, ...styles.suggestionItem }}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Header({
  onRefresh,
  generatedAt,
  refreshDisabled = false,
}: {
  onRefresh: () => void
  generatedAt?: string
  refreshDisabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div>
        <span style={{ fontWeight: 700, fontSize: 16 }}>🤖 AI Portfolio Insights</span>
        {generatedAt && (
          <span style={{ marginLeft: 10, fontSize: 12, color: '#999' }}>
            Updated {timeAgo(generatedAt)}
          </span>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshDisabled}
        style={{
          background: 'none', border: '1px solid #ddd', borderRadius: 6,
          padding: '5px 12px', fontSize: 12, cursor: refreshDisabled ? 'not-allowed' : 'pointer',
          color: refreshDisabled ? '#bbb' : '#555',
        }}
      >
        ↻ Refresh
      </button>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  card: {
    border: '1px solid #e8e8e8',
    borderRadius: 12,
    padding: '20px 24px',
    background: '#fafafa',
    marginBottom: 32,
  },
  summary: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#333',
    margin: '0 0 16px',
  },
  section: {
    marginTop: 12,
  },
  sectionLabel: {
    fontWeight: 600,
    fontSize: 13,
    margin: '0 0 8px',
    color: '#444',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  listItem: {
    fontSize: 13,
    lineHeight: 1.5,
    padding: '6px 12px',
    borderRadius: 6,
  },
  flagItem: {
    background: '#fff8e1',
    color: '#7c5e00',
    borderLeft: '3px solid #f59e0b',
  },
  suggestionItem: {
    background: '#f0fdf4',
    color: '#14532d',
    borderLeft: '3px solid #22c55e',
  },
  muted: {
    fontSize: 13,
    color: '#888',
    margin: 0,
  },
  skeleton: {
    padding: '4px 0',
  },
  skeletonLine: {
    height: 14,
    background: 'linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%)',
    backgroundSize: '200% 100%',
    borderRadius: 4,
    animation: 'shimmer 1.5s infinite',
  },
}
