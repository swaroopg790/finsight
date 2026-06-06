import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, AlertTriangle, Lightbulb, RotateCw } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'

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

  const header = (generatedAt?: string) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-indigo-400" />
        </div>
        <span className="text-white font-semibold text-sm">AI Insights</span>
        {generatedAt && (
          <span className="text-slate-600 text-xs">{timeAgo(generatedAt)}</span>
        )}
      </div>
      <button
        onClick={handleRefresh}
        title="Refresh insights"
        className="text-slate-500 hover:text-indigo-400 transition-colors p-1"
      >
        <RotateCw size={14} />
      </button>
    </div>
  )

  if (!hasHoldings) {
    return (
      <div className="glass rounded-2xl p-4 md:p-6 mb-4">
        {header()}
        <p className="text-slate-500 text-sm text-center my-8">
          Connect a brokerage account to unlock AI portfolio analysis.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-4 md:p-6 mb-4">
        {header()}
        <div className="flex flex-col gap-2">
          <div className="skeleton h-4 rounded w-full" />
          <div className="skeleton h-4 rounded w-4/5" />
          <div className="skeleton h-4 rounded w-3/5" />
        </div>
        <p className="text-slate-600 text-xs mt-4">Analysing your portfolio with AI…</p>
      </div>
    )
  }

  if (isError) {
    const msg = (error as { response?: { status: number } })?.response?.status === 503
      ? 'AI service is offline. Start the AI service and refresh.'
      : 'Could not load insights. Please try again.'
    return (
      <div className="glass rounded-2xl p-4 md:p-6 mb-4">
        {header()}
        <p className="text-red-400 text-sm">{msg}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="glass rounded-2xl p-4 md:p-6 mb-4">
      {header(data.generatedAt)}

      {/* Summary */}
      <p className="text-slate-300 text-sm leading-relaxed mb-4">{data.summary}</p>

      {/* Risk flags */}
      {data.riskFlags?.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} className="text-amber-400" />
            <span className="label-xs text-amber-400/80">Risk Flags</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.riskFlags.map((flag, i) => (
              <li key={i}
                className="flex items-start gap-2 bg-amber-500/[0.06] border border-amber-500/10 rounded-lg px-3 py-2 text-xs text-amber-300/80">
                <span className="mt-0.5 shrink-0">⚠</span>
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={13} className="text-emerald-400" />
            <span className={cn('label-xs', 'text-emerald-400/80')}>Suggestions</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.suggestions.map((s, i) => (
              <li key={i}
                className="flex items-start gap-2 bg-emerald-500/[0.06] border border-emerald-500/10 rounded-lg px-3 py-2 text-xs text-emerald-300/80">
                <span className="mt-0.5 shrink-0">💡</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
