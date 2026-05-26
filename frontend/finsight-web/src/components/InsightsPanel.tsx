import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, AlertTriangle, Lightbulb, RotateCw } from 'lucide-react'
import api from '../lib/api'
import { colors, radius, shadow } from '../lib/tokens'

interface InsightResponse {
  summary:     string
  riskFlags:   string[]
  suggestions: string[]
  generatedAt: string
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function InsightsPanel({ hasHoldings }: { hasHoldings: boolean }) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery<InsightResponse>({
    queryKey:  ['insights'],
    queryFn:   () => api.get('/insights').then(r => r.data),
    enabled:   hasHoldings,
    staleTime: 29 * 60 * 1000,
    retry:     false,
  })

  const handleRefresh = async () => {
    await api.delete('/insights/cache').catch(() => {})
    queryClient.invalidateQueries({ queryKey: ['insights'] })
  }

  // ── Shared card wrapper ────────────────────────────────────────────────────
  const card = (content: React.ReactNode) => (
    <div style={{
      background:   colors.surface,
      borderRadius: radius.lg,
      padding:      '20px 22px',
      marginBottom: 16,
      border:       `1px solid ${colors.border}`,
      boxShadow:    shadow.sm,
      display:      'flex',
      flexDirection:'column',
      gap:          0,
    }}>
      {content}
    </div>
  )

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasHoldings) {
    return card(
      <>
        <Header onRefresh={handleRefresh} refreshDisabled />
        <p style={s.muted}>
          Connect a brokerage account to unlock AI portfolio analysis.
        </p>
      </>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return card(
      <>
        <Header onRefresh={handleRefresh} refreshDisabled />
        <div style={{ padding: '4px 0' }}>
          <div style={{ ...s.skeletonLine, width: '90%' }} />
          <div style={{ ...s.skeletonLine, width: '75%', marginTop: 8 }} />
          <div style={{ ...s.skeletonLine, width: '60%', marginTop: 8 }} />
        </div>
        <p style={{ ...s.muted, marginTop: 12 }}>Analysing your portfolio with Llama 3.3…</p>
      </>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError) {
    const msg = (error as { response?: { status: number } })?.response?.status === 503
      ? 'AI service is offline. Start the AI service and refresh.'
      : 'Could not load insights. Please try again.'
    return card(
      <>
        <Header onRefresh={handleRefresh} />
        <p style={{ ...s.muted, color: colors.dangerText }}>{msg}</p>
      </>
    )
  }

  if (!data) return null

  // ── Insights ───────────────────────────────────────────────────────────────
  return card(
    <>
      <Header onRefresh={handleRefresh} generatedAt={data.generatedAt} />

      {/* Summary */}
      <p style={s.summary}>{data.summary}</p>

      {/* Risk Flags */}
      {data.riskFlags?.length > 0 && (
        <section style={s.section}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertTriangle size={13} color={colors.warning} />
            <p style={s.sectionLabel}>Risk Flags</p>
          </div>
          <ul style={s.list}>
            {data.riskFlags.map((flag, i) => (
              <li key={i} style={{ ...s.listItem, ...s.flagItem }}>{flag}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Suggestions */}
      {data.suggestions?.length > 0 && (
        <section style={s.section}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Lightbulb size={13} color={colors.success} />
            <p style={s.sectionLabel}>Suggestions</p>
          </div>
          <ul style={s.list}>
            {data.suggestions.map((suggestion, i) => (
              <li key={i} style={{ ...s.listItem, ...s.suggestionItem }}>{suggestion}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────────
function Header({
  onRefresh,
  generatedAt,
  refreshDisabled = false,
}: {
  onRefresh:       () => void
  generatedAt?:    string
  refreshDisabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width:        28,
          height:       28,
          borderRadius: radius.sm,
          background:   colors.brandBg,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          flexShrink:   0,
        }}>
          <Sparkles size={13} color={colors.brand} />
        </div>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>AI Portfolio Insights</span>
          {generatedAt && (
            <span style={{ marginLeft: 8, fontSize: 11, color: colors.textMuted }}>
              Updated {timeAgo(generatedAt)}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onRefresh}
        disabled={refreshDisabled}
        title="Refresh insights"
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         5,
          background:  'none',
          border:      `1px solid ${colors.border}`,
          borderRadius: radius.sm,
          padding:     '5px 10px',
          fontSize:    12,
          cursor:      refreshDisabled ? 'not-allowed' : 'pointer',
          color:       refreshDisabled ? colors.textMuted : colors.textSecondary,
          transition:  'all 0.15s',
          minHeight:   30,
        }}
        onMouseEnter={(e) => { if (!refreshDisabled) { e.currentTarget.style.borderColor = colors.brand; e.currentTarget.style.color = colors.brand } }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = refreshDisabled ? colors.textMuted : colors.textSecondary }}
      >
        <RotateCw size={12} />
        Refresh
      </button>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  summary: {
    fontSize:   14,
    lineHeight: 1.65,
    color:      colors.textSecondary,
    margin:     '0 0 14px',
  },
  section: {
    marginTop: 12,
  },
  sectionLabel: {
    fontWeight: 600,
    fontSize:   12,
    margin:     0,
    color:      colors.text,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  list: {
    listStyle:     'none',
    margin:        0,
    padding:       0,
    display:       'flex',
    flexDirection: 'column',
    gap:           5,
  },
  listItem: {
    fontSize:   13,
    lineHeight: 1.5,
    padding:    '7px 12px',
    borderRadius: radius.sm,
  },
  flagItem: {
    background:  colors.warningBg,
    color:       colors.warningText,
    borderLeft:  `3px solid ${colors.warning}`,
  },
  suggestionItem: {
    background: colors.successBg,
    color:      colors.successText,
    borderLeft: `3px solid ${colors.success}`,
  },
  muted: {
    fontSize: 13,
    color:    colors.textMuted,
    margin:   0,
  },
  skeletonLine: {
    height:          14,
    background:      'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
    backgroundSize:  '200% 100%',
    borderRadius:    radius.xs,
    animation:       'shimmer 1.5s infinite',
  } as React.CSSProperties,
}
