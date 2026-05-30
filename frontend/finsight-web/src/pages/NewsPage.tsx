import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Newspaper, Sparkles, TrendingUp, TrendingDown, Minus,
  RefreshCw, ExternalLink, Calendar, Clock, AlertCircle,
} from 'lucide-react'
import { useBreakpoint } from '../hooks/useBreakpoint'
import api from '../lib/api'
import { colors, radius, shadow } from '../lib/tokens'

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

function sentimentColor(s: 'BULLISH' | 'BEARISH' | 'NEUTRAL') {
  if (s === 'BULLISH') return { text: '#10b981', bg: 'rgba(16,185,129,0.1)' }
  if (s === 'BEARISH') return { text: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  return { text: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
}

function SentimentBadge({ sentiment }: { sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' }) {
  const { text, bg } = sentimentColor(sentiment)
  const Icon = sentiment === 'BULLISH' ? TrendingUp : sentiment === 'BEARISH' ? TrendingDown : Minus
  return (
    <span style={{
      display:     'inline-flex',
      alignItems:  'center',
      gap:         3,
      padding:     '2px 7px',
      borderRadius: radius.full,
      background:  bg,
      color:       text,
      fontSize:    10,
      fontWeight:  600,
      letterSpacing: '0.5px',
      textTransform: 'uppercase' as const,
    }}>
      <Icon size={10} />
      {sentiment}
    </span>
  )
}

// ── Sentiment Strip ───────────────────────────────────────────────────────────

function SentimentStrip({ sentimentByTicker }: { sentimentByTicker: Record<string, TickerSentiment> }) {
  const entries = Object.values(sentimentByTicker).slice(0, 8)
  if (entries.length === 0) return null

  return (
    <div style={{
      background:   colors.surface,
      borderRadius: radius.md,
      border:       `1px solid ${colors.border}`,
      padding:      '14px 18px',
      boxShadow:    shadow.sm,
    }}>
      <p style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: '0.6px',
                  textTransform: 'uppercase', margin: '0 0 12px' }}>
        Analyst Sentiment · Your Holdings
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
        {entries.map(s => {
          const { text, bg } = sentimentColor(s.label)
          return (
            <div key={s.ticker} title={s.topHeadline} style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '6px 10px',
              borderRadius: radius.sm,
              background:   bg,
              border:       `1px solid ${text}30`,
              cursor:       'default',
            }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: 13 }}>{s.ticker}</span>
              <span style={{ color: text, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
              <span style={{ color: colors.textMuted, fontSize: 10 }}>
                {s.articleCount} art.
              </span>
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
    <div style={{
      background:   colors.surface,
      borderRadius: radius.md,
      border:       `1px solid ${colors.border}`,
      padding:      '14px 18px',
      boxShadow:    shadow.sm,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Calendar size={14} color={colors.brand} />
        <p style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: '0.6px',
                    textTransform: 'uppercase', margin: 0 }}>
          Upcoming Earnings · Your Holdings
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
        {earnings.slice(0, 5).map(e => (
          <div key={e.ticker} style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '8px 12px',
            borderRadius:   radius.sm,
            background:     colors.pageBg,
            border:         `1px solid ${colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontWeight:   700, fontSize: 13, color: colors.brand,
                minWidth:     44,
              }}>
                {e.ticker}
              </span>
              <span style={{ color: colors.text, fontSize: 13, fontWeight: 500 }}>
                {e.companyName.length > 28 ? e.companyName.slice(0, 25) + '…' : e.companyName}
              </span>
              <span style={{ color: colors.textMuted, fontSize: 11 }}>{e.quarter}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: colors.text, fontSize: 12 }}>
                {new Date(e.reportDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span style={{
                padding:      '2px 8px',
                borderRadius: radius.full,
                background:   e.daysUntil <= 7 ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.1)',
                color:        e.daysUntil <= 7 ? '#f59e0b' : colors.textMuted,
                fontSize:     10, fontWeight: 600,
              }}>
                {e.daysUntil === 0 ? 'Today' : `${e.daysUntil}d`}
              </span>
              {e.estimated && (
                <span style={{ color: colors.textMuted, fontSize: 9 }} title="Estimated date">~est.</span>
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
    <div style={{
      background:   'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)',
      borderRadius: radius.lg,
      padding:      '20px 22px',
      boxShadow:    shadow.md,
      border:       '1px solid rgba(99,102,241,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: radius.sm,
            background: 'rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={14} color="#a5b4fc" />
          </div>
          <div>
            <p style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 700,
                        letterSpacing: '0.6px', textTransform: 'uppercase' as const, margin: 0 }}>
              AI Portfolio Impact
            </p>
            <p style={{ color: 'rgba(165,180,252,0.5)', fontSize: 10, margin: 0 }}>
              What today's news means for YOU
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                      color: 'rgba(165,180,252,0.5)', fontSize: 10 }}>
          <Clock size={10} />
          {time}
          {stale && <span style={{ color: '#f59e0b', marginLeft: 4 }}>· stale</span>}
        </div>
      </div>
      <p style={{ color: '#e0e7ff', fontSize: 14, lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
        "{summary}"
      </p>
    </div>
  )
}

// ── News Article Card ─────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: NewsArticle }) {
  const { text: sentColor } = sentimentColor(article.sentiment)

  return (
    <div style={{
      background:   colors.surface,
      borderRadius: radius.md,
      border:       `1px solid ${colors.border}`,
      padding:      '14px 16px',
      boxShadow:    shadow.sm,
      display:      'flex',
      flexDirection: 'column' as const,
      gap:           8,
    }}>
      {/* Ticker tags + sentiment */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
        {(article.relevantTickers.length > 0
            ? article.relevantTickers
            : article.tickers
        ).slice(0, 4).map(t => (
          <span key={t} style={{
            padding:      '2px 8px',
            borderRadius: radius.full,
            background:   `${colors.brand}18`,
            color:        colors.brand,
            fontSize:     10,
            fontWeight:   700,
          }}>
            {t}
          </span>
        ))}
        <SentimentBadge sentiment={article.sentiment} />
        <span style={{ marginLeft: 'auto', color: colors.textMuted, fontSize: 11 }}>
          {article.relativeTime}
        </span>
      </div>

      {/* Title */}
      <p style={{
        color: colors.text, fontSize: 14, fontWeight: 600, margin: 0,
        lineHeight: 1.4,
      }}>
        {article.title}
      </p>

      {/* Description */}
      {article.description && (
        <p style={{
          color: colors.textMuted, fontSize: 13, margin: 0, lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        } as React.CSSProperties}>
          {article.description}
        </p>
      )}

      {/* Sentiment reasoning */}
      {article.sentimentReasoning && (
        <p style={{
          color: sentColor, fontSize: 11, margin: 0, fontStyle: 'italic',
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        } as React.CSSProperties}>
          {article.sentimentReasoning}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: colors.textMuted, fontSize: 11 }}>{article.publisher}</span>
        <a
          href={article.articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        4,
            color:      colors.brand,
            fontSize:   11,
            fontWeight: 600,
            textDecoration: 'none',
          }}
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
    <div style={{
      textAlign:    'center',
      padding:      '60px 20px',
      color:        colors.textMuted,
    }}>
      <Newspaper size={48} color={colors.border} style={{ marginBottom: 16 }} />
      <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: '0 0 8px' }}>
        No holdings yet
      </p>
      <p style={{ fontSize: 14, margin: 0 }}>
        Connect a brokerage account to see news filtered to your portfolio.
      </p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const { isMobile } = useBreakpoint()
  const qc = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'>('ALL')

  const { data, isLoading, isError } = useQuery<PortfolioNewsResponse>({
    queryKey: ['news-feed'],
    queryFn:  () => api.get('/api/v1/news/feed').then(r => r.data),
    staleTime: 10 * 60 * 1000,  // 10 min
    refetchInterval: 15 * 60 * 1000,
  })

  const { mutate: refresh, isPending: refreshing } = useMutation({
    mutationFn: () => api.post('/api/v1/news/refresh').then(r => r.data),
    onSuccess: (fresh: PortfolioNewsResponse) => {
      qc.setQueryData(['news-feed'], fresh)
    },
  })

  const PAD = isMobile ? '16px' : '32px 40px'

  if (isLoading) return (
    <div style={{ padding: PAD, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          height: 100, borderRadius: radius.md,
          background: colors.surface, border: `1px solid ${colors.border}`,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )

  if (isError) return (
    <div style={{ padding: PAD }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: radius.md, color: '#ef4444',
      }}>
        <AlertCircle size={16} />
        <span>Failed to load news. Please try again.</span>
      </div>
    </div>
  )

  const articles = (data?.articles ?? []).filter(
    a => activeFilter === 'ALL' || a.sentiment === activeFilter
  )

  const holdingsCount = data?.topHoldings.length ?? 0

  return (
    <div style={{ padding: PAD, maxWidth: 820, margin: '0 auto' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   24,
        flexWrap:       'wrap',
        gap:            12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Newspaper size={22} color={colors.brand} />
            <h1 style={{ color: colors.text, fontSize: isMobile ? 20 : 24,
                         fontWeight: 700, margin: 0 }}>
              Portfolio News
            </h1>
          </div>
          <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>
            {holdingsCount > 0
              ? `Filtered to your ${holdingsCount} holding${holdingsCount === 1 ? '' : 's'} · not Bloomberg's generic feed`
              : 'Connect a brokerage account to filter by your holdings'}
          </p>
        </div>

        <button
          onClick={() => refresh()}
          disabled={refreshing}
          style={{
            display:     'flex',
            alignItems:  'center',
            gap:         6,
            padding:     '8px 14px',
            borderRadius: radius.sm,
            border:      `1px solid ${colors.border}`,
            background:  colors.surface,
            color:       colors.text,
            fontSize:    13, fontWeight: 500,
            cursor:      refreshing ? 'not-allowed' : 'pointer',
            opacity:     refreshing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {holdingsCount === 0 && !isLoading ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── AI Summary ──────────────────────────────────────────────── */}
          {data?.aiSummary && (
            <AiSummaryCard
              summary={data.aiSummary}
              generatedAt={data.generatedAt}
              stale={data.stale}
            />
          )}

          {/* ── Sentiment Strip ─────────────────────────────────────────── */}
          {data?.sentimentByTicker && Object.keys(data.sentimentByTicker).length > 0 && (
            <SentimentStrip sentimentByTicker={data.sentimentByTicker} />
          )}

          {/* ── Earnings Calendar ───────────────────────────────────────── */}
          {data?.earnings && data.earnings.length > 0 && (
            <EarningsCalendar earnings={data.earnings} />
          )}

          {/* ── Filter tabs ─────────────────────────────────────────────── */}
          {data && data.articles.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map(f => {
                const active = activeFilter === f
                const { text, bg } = f === 'ALL'
                  ? { text: colors.brand, bg: `${colors.brand}15` }
                  : sentimentColor(f as any)
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    style={{
                      padding:     '5px 12px',
                      borderRadius: radius.full,
                      border:      `1px solid ${active ? text : colors.border}`,
                      background:  active ? bg : 'transparent',
                      color:       active ? text : colors.textMuted,
                      fontSize:    12, fontWeight: 500,
                      cursor:      'pointer',
                    }}
                  >
                    {f}
                    {f !== 'ALL' && (
                      <span style={{ marginLeft: 4, opacity: 0.7 }}>
                        ({data.articles.filter(a => a.sentiment === f).length})
                      </span>
                    )}
                  </button>
                )
              })}
              {activeFilter === 'ALL' && (
                <span style={{ marginLeft: 'auto', color: colors.textMuted, fontSize: 12 }}>
                  {data.articles.length} articles
                </span>
              )}
            </div>
          )}

          {/* ── Articles ────────────────────────────────────────────────── */}
          {articles.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', padding: 32 }}>
              No {activeFilter !== 'ALL' ? activeFilter.toLowerCase() + ' ' : ''}articles today.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {articles.map(a => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}

          {/* ── Footer note ─────────────────────────────────────────────── */}
          <p style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center',
                      padding: '8px 0 24px', margin: 0 }}>
            News sourced from Polygon.io · AI analysis powered by Groq · Updates every 15 minutes
          </p>
        </div>
      )}
    </div>
  )
}
