import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Newspaper, Sparkles, TrendingUp, TrendingDown, Minus,
  RefreshCw, ExternalLink, Calendar, Clock, AlertCircle,
} from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewsArticle {
  id: string
  title: string
  description: string | null
  publishedUtc: string
  articleUrl: string
  imageUrl: string | null
  publisher: string
  tickers: string[]
  relevantTickers: string[]
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  sentimentReasoning: string | null
  relativeTime: string
}

interface TickerSentiment {
  ticker: string
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  score: number
  articleCount: number
  topHeadline: string
}

interface EarningsEvent {
  ticker: string
  companyName: string
  reportDate: string
  daysUntil: number
  quarter: string
  estimated: boolean
}

interface PortfolioNewsResponse {
  articles: NewsArticle[]
  earnings: EarningsEvent[]
  sentimentByTicker: Record<string, TickerSentiment>
  aiSummary: string
  topHoldings: string[]
  portfolioValue: number
  generatedAt: string
  stale: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL'

function sentimentClasses(s: Sentiment) {
  if (s === 'BULLISH') return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' }
  if (s === 'BEARISH') return { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30'     }
  return                       { text: 'text-slate-400',  bg: 'bg-slate-500/10',   border: 'border-slate-500/20'   }
}

// ── Sentiment Badge ───────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const cls  = sentimentClasses(sentiment)
  const Icon = sentiment === 'BULLISH' ? TrendingUp : sentiment === 'BEARISH' ? TrendingDown : Minus
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
      cls.text, cls.bg
    )}>
      <Icon size={9} />
      {sentiment}
    </span>
  )
}

// ── Sentiment Strip ───────────────────────────────────────────────────────────

function SentimentStrip({ sentimentByTicker }: { sentimentByTicker: Record<string, TickerSentiment> }) {
  const entries = Object.values(sentimentByTicker).slice(0, 8)
  if (entries.length === 0) return null

  return (
    <div className="glass rounded-2xl p-4">
      <p className="label-xs mb-3">Analyst Sentiment · Your Holdings</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(s => {
          const cls = sentimentClasses(s.label)
          return (
            <div key={s.ticker} title={s.topHeadline}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-default',
                cls.bg, cls.border
              )}>
              <span className="text-slate-100 font-bold">{s.ticker}</span>
              <span className={cn('font-semibold', cls.text)}>{s.label}</span>
              <span className="text-slate-500">{s.articleCount} art.</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Earnings Calendar ─────────────────────────────────────────────────────────

function EarningsCalendar({ earnings }: { earnings: EarningsEvent[] }) {
  if (earnings.length === 0) return null

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-indigo-400" />
        <p className="label-xs">Upcoming Earnings · Your Holdings</p>
      </div>
      <div className="flex flex-col gap-2">
        {earnings.slice(0, 5).map(e => (
          <div key={e.ticker}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <span className="text-indigo-400 font-bold text-sm min-w-[44px]">{e.ticker}</span>
              <span className="text-slate-200 text-sm font-medium">
                {e.companyName.length > 28 ? e.companyName.slice(0, 25) + '…' : e.companyName}
              </span>
              <span className="text-slate-500 text-xs">{e.quarter}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-xs">
                {new Date(e.reportDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                e.daysUntil <= 7 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-500/10 text-slate-500'
              )}>
                {e.daysUntil === 0 ? 'Today' : `${e.daysUntil}d`}
              </span>
              {e.estimated && (
                <span className="text-slate-600 text-[9px]" title="Estimated date">~est.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── AI Summary Card ───────────────────────────────────────────────────────────

function AiSummaryCard({ summary, generatedAt, stale }: {
  summary: string
  generatedAt: string
  stale: boolean
}) {
  const time = (() => {
    try {
      const mins = Math.floor((Date.now() - new Date(generatedAt).getTime()) / 60000)
      if (mins < 1) return 'just now'
      if (mins < 60) return `${mins}m ago`
      return `${Math.floor(mins / 60)}h ago`
    } catch { return '' }
  })()

  return (
    <div className="rounded-2xl p-5 border border-indigo-500/30"
      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/30 flex items-center justify-center">
            <Sparkles size={13} className="text-indigo-300" />
          </div>
          <div>
            <p className="text-indigo-300 text-[11px] font-bold uppercase tracking-widest">
              AI Portfolio Impact
            </p>
            <p className="text-indigo-400/50 text-[10px]">What today's news means for YOU</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-indigo-400/50 text-[10px] shrink-0">
          <Clock size={10} />
          {time}
          {stale && <span className="text-amber-400 ml-1">· stale</span>}
        </div>
      </div>
      <p className="text-indigo-100 text-sm leading-relaxed italic">"{summary}"</p>
    </div>
  )
}

// ── News Article Card ─────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: NewsArticle }) {
  const sentCls = sentimentClasses(article.sentiment)

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-2.5 hover:bg-white/[0.04] transition-colors">
      {/* Ticker tags + sentiment + time */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(article.relevantTickers.length > 0
            ? article.relevantTickers
            : article.tickers
        ).slice(0, 4).map(t => (
          <span key={t}
            className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold">
            {t}
          </span>
        ))}
        <SentimentBadge sentiment={article.sentiment} />
        <span className="ml-auto text-slate-500 text-xs">{article.relativeTime}</span>
      </div>

      {/* Title */}
      <p className="text-slate-100 text-sm font-semibold leading-snug">{article.title}</p>

      {/* Description */}
      {article.description && (
        <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
          {article.description}
        </p>
      )}

      {/* Sentiment reasoning */}
      {article.sentimentReasoning && (
        <p className={cn('text-[11px] italic line-clamp-1', sentCls.text)}>
          {article.sentimentReasoning}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-slate-500 text-xs">{article.publisher}</span>
        <a
          href={article.articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-indigo-400 text-xs font-semibold hover:text-indigo-300 transition-colors"
        >
          Read <ExternalLink size={10} />
        </a>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-16">
      <Newspaper size={48} className="text-white/[0.06] mx-auto mb-4" />
      <p className="text-white text-base font-semibold mb-2">No holdings yet</p>
      <p className="text-slate-500 text-sm">
        Connect a brokerage account to see news filtered to your portfolio.
      </p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const qc = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'>('ALL')

  const { data, isLoading, isError } = useQuery<PortfolioNewsResponse>({
    queryKey: ['news-feed'],
    queryFn:  () => api.get('/api/v1/news/feed').then(r => r.data),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  })

  const { mutate: refresh, isPending: refreshing } = useMutation({
    mutationFn: () => api.post('/api/v1/news/refresh').then(r => r.data),
    onSuccess: (fresh: PortfolioNewsResponse) => {
      qc.setQueryData(['news-feed'], fresh)
    },
  })

  if (isLoading) return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 flex flex-col gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton h-24 rounded-2xl" />
      ))}
    </div>
  )

  if (isError) return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8">
      <div className="flex items-center gap-2.5 px-4 py-3.5 glass rounded-xl border-l-2 border-l-red-500">
        <AlertCircle size={16} className="text-red-400 shrink-0" />
        <span className="text-red-400 text-sm">Failed to load news. Please try again.</span>
      </div>
    </div>
  )

  const articles = (data?.articles ?? []).filter(
    a => activeFilter === 'ALL' || a.sentiment === activeFilter
  )
  const holdingsCount = data?.topHoldings.length ?? 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Newspaper size={15} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Portfolio News</h1>
          </div>
          <p className="text-slate-500 text-sm ml-11">
            {holdingsCount > 0
              ? `Filtered to your ${holdingsCount} holding${holdingsCount === 1 ? '' : 's'} · not Bloomberg's generic feed`
              : 'Connect a brokerage account to filter by your holdings'}
          </p>
        </div>
        <button
          onClick={() => refresh()}
          disabled={refreshing}
          className={cn('btn-ghost flex items-center gap-1.5 text-sm px-3 py-2', refreshing && 'opacity-60 cursor-not-allowed')}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </motion.div>

      {holdingsCount === 0 && !isLoading ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">

          {/* AI Summary */}
          {data?.aiSummary && (
            <AiSummaryCard
              summary={data.aiSummary}
              generatedAt={data.generatedAt}
              stale={data.stale}
            />
          )}

          {/* Sentiment Strip */}
          {data?.sentimentByTicker && Object.keys(data.sentimentByTicker).length > 0 && (
            <SentimentStrip sentimentByTicker={data.sentimentByTicker} />
          )}

          {/* Earnings Calendar */}
          {data?.earnings && data.earnings.length > 0 && (
            <EarningsCalendar earnings={data.earnings} />
          )}

          {/* Filter tabs */}
          {data && data.articles.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map(f => {
                const active = activeFilter === f
                const cls = f === 'ALL'
                  ? { text: 'text-indigo-400', activeBg: 'bg-indigo-500/10', activeBorder: 'border-indigo-500/50' }
                  : (() => {
                      const s = sentimentClasses(f)
                      return { text: s.text, activeBg: s.bg, activeBorder: s.border }
                    })()
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150',
                      active
                        ? cn(cls.text, cls.activeBg, cls.activeBorder)
                        : 'text-slate-500 border-white/[0.08] hover:text-slate-300'
                    )}
                  >
                    {f}
                    {f !== 'ALL' && (
                      <span className="ml-1 opacity-70">
                        ({data.articles.filter(a => a.sentiment === f).length})
                      </span>
                    )}
                  </button>
                )
              })}
              {activeFilter === 'ALL' && (
                <span className="ml-auto text-slate-500 text-xs">{data.articles.length} articles</span>
              )}
            </div>
          )}

          {/* Articles */}
          {articles.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              No {activeFilter !== 'ALL' ? activeFilter.toLowerCase() + ' ' : ''}articles today.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {articles.map(a => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}

          {/* Footer note */}
          <p className="text-slate-600 text-xs text-center py-4">
            News sourced from Polygon.io · AI analysis powered by Groq · Updates every 15 minutes
          </p>
        </div>
      )}
    </div>
  )
}
