import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calculator, TrendingUp,
  AlertTriangle, Scissors, ChevronDown, ChevronUp,
  CheckCircle, Info,
} from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { colors, radius, shadow } from '../lib/tokens'

// ── API response types ────────────────────────────────────────────────────────
interface RealizedGainItem {
  ticker:       string
  securityName: string | null
  quantity:     number
  proceeds:     number
  costBasis:    number
  gainLoss:     number
  longTerm:     boolean
  saleDate:     string
  purchaseDate: string
  holdingDays:  number
  accountName:  string | null
}

interface HarvestOpportunity {
  ticker:              string
  securityName:        string | null
  quantity:            number
  currentValue:        number
  costBasis:           number
  unrealizedLoss:      number
  estimatedTaxSavings: number
  shortTerm:           boolean
  washSaleRisk:        boolean
  recommendation:      string
}

interface WashSaleWarning {
  ticker:          string
  securityName:    string | null
  saleDate:        string
  relatedBuyDate:  string
  lossAmount:      number
  message:         string
}

interface TaxSummaryResponse {
  taxYear:                 number
  costBasisMethod:         string
  shortTermRealizedGains:  number
  longTermRealizedGains:   number
  totalRealizedGains:      number
  shortTermUnrealizedGains: number
  longTermUnrealizedGains:  number
  totalUnrealizedGains:     number
  estimatedTaxOwed:        number
  shortTermTaxRate:        number
  longTermTaxRate:         number
  daysRemainingInYear:     number
  yearEndAdvice:           string
  totalHarvestableLosses:  number
  estimatedHarvestSavings: number
  realizedGains:           RealizedGainItem[]
  harvestOpportunities:    HarvestOpportunity[]
  washSaleWarnings:        WashSaleWarning[]
}

// ── Cost basis options ────────────────────────────────────────────────────────
type BasisMethod = 'FIFO' | 'LIFO' | 'HIGHEST_COST'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtUsd = (v: number) =>
  '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtQty = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return new Date(Number(y), Number(m) - 1, Number(day))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const gainColor  = (v: number) => v >= 0 ? colors.success : colors.danger
const signedUsd  = (v: number) => (v >= 0 ? '+' : '') + fmtUsd(v)

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TaxPage() {
  const { isMobile } = useBreakpoint()
  const currentYear  = new Date().getFullYear()

  const [year,   setYear]   = useState(currentYear)
  const [method, setMethod] = useState<BasisMethod>('FIFO')
  const [showRealizedTable, setShowRealizedTable] = useState(false)

  const { data, isLoading, isError } = useQuery<TaxSummaryResponse>({
    queryKey: ['tax', year, method],
    queryFn:  () =>
      api.get(`/tax/summary?year=${year}&method=${method}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const pad = isMobile ? '16px' : '28px 32px'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: pad }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: radius.sm,
            background: colors.brandBg, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Calculator size={16} color={colors.brand} />
          </div>
          <h1 style={{
            fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0,
            letterSpacing: '-0.5px', color: colors.text,
          }}>
            Tax Intelligence
          </h1>
        </div>
        <p style={{ color: colors.textMuted, margin: 0, fontSize: 13 }}>
          Realized gains · Tax-loss harvesting · Wash-sale alerts · Year-end planning
        </p>
      </div>

      {/* ── Controls: year + method ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Year picker */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[currentYear - 1, currentYear].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                padding:      '6px 14px',
                borderRadius: radius.sm,
                border:       'none',
                fontSize:     13,
                fontWeight:   year === y ? 700 : 500,
                cursor:       'pointer',
                background:   year === y ? colors.brand : colors.surfaceHover,
                color:        year === y ? '#fff' : colors.textMuted,
                transition:   'all 0.15s',
                minHeight:    32,
              }}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Method selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500 }}>
            Cost basis:
          </span>
          {(['FIFO', 'LIFO', 'HIGHEST_COST'] as BasisMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              style={{
                padding:      '5px 10px',
                borderRadius: radius.sm,
                border:       `1px solid ${method === m ? colors.brand : colors.border}`,
                fontSize:     11,
                fontWeight:   method === m ? 700 : 500,
                cursor:       'pointer',
                background:   method === m ? colors.brandBg : 'transparent',
                color:        method === m ? colors.brand : colors.textMuted,
                transition:   'all 0.15s',
                letterSpacing: '0.2px',
              }}
            >
              {m === 'HIGHEST_COST' ? 'High Cost' : m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading / error ──────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState />
      ) : isError || !data ? (
        <ErrorState />
      ) : (
        <TaxContent data={data} isMobile={isMobile} showRealizedTable={showRealizedTable}
                    setShowRealizedTable={setShowRealizedTable} />
      )}
    </div>
  )
}

// ── Main content (once data is loaded) ───────────────────────────────────────
function TaxContent({
  data, isMobile, showRealizedTable, setShowRealizedTable,
}: {
  data:                  TaxSummaryResponse
  isMobile:              boolean
  showRealizedTable:     boolean
  setShowRealizedTable:  (v: boolean) => void
}) {
  const hasActivity = data.realizedGains.length > 0
      || data.totalUnrealizedGains !== 0
      || data.harvestOpportunities.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Year-end advice banner ───────────────────────────────────────── */}
      {data.yearEndAdvice && (
        <div style={{
          background:   colors.brandBg,
          border:       `1px solid ${colors.brandBorder}`,
          borderRadius: radius.lg,
          padding:      isMobile ? '12px 14px' : '14px 18px',
          display:      'flex',
          gap:          10,
          alignItems:   'flex-start',
        }}>
          <Info size={16} color={colors.brand} style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
            {data.yearEndAdvice}
          </p>
        </div>
      )}

      {/* ── 4 summary cards ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 12,
      }}>
        <SummaryCard
          label="Short-Term Gains"
          value={data.shortTermRealizedGains}
          sub={`Taxed at ${(data.shortTermTaxRate * 100).toFixed(0)}%`}
          icon={<TrendingUp size={14} />}
        />
        <SummaryCard
          label="Long-Term Gains"
          value={data.longTermRealizedGains}
          sub={`Taxed at ${(data.longTermTaxRate * 100).toFixed(0)}%`}
          icon={<TrendingUp size={14} />}
        />
        <SummaryCard
          label="Unrealized P&L"
          value={data.totalUnrealizedGains}
          sub="Current positions"
          icon={<Calculator size={14} />}
        />
        <SummaryCard
          label="Est. Tax Owed"
          value={-data.estimatedTaxOwed}   // show as cost (negative)
          sub={`Based on ${data.taxYear} activity`}
          icon={<AlertTriangle size={14} />}
          forceNegative
        />
      </div>

      {/* ── No activity message ──────────────────────────────────────────── */}
      {!hasActivity && (
        <div style={{
          background:   colors.surface,
          border:       `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          padding:      '32px 24px',
          textAlign:    'center',
          boxShadow:    shadow.sm,
        }}>
          <Calculator size={28} color={colors.textMuted} style={{ marginBottom: 10 }} />
          <p style={{ color: colors.textSecondary, fontSize: 14, margin: '0 0 4px', fontWeight: 600 }}>
            No tax activity for {data.taxYear}
          </p>
          <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>
            Connect a brokerage and sync transactions to see your tax picture.
          </p>
        </div>
      )}

      {/* ── Harvest opportunities ────────────────────────────────────────── */}
      {data.harvestOpportunities.length > 0 && (
        <Section
          icon={<Scissors size={15} color={colors.brand} />}
          title="Tax-Loss Harvesting Opportunities"
          badge={data.harvestOpportunities.length}
          badgeColor={colors.brand}
          subtitle={
            `~${fmtUsd(data.estimatedHarvestSavings)} in potential tax savings · ` +
            `${data.daysRemainingInYear} days left in ${data.taxYear}`
          }
          isMobile={isMobile}
        >
          {data.harvestOpportunities.map((opp, i) => (
            <HarvestCard key={opp.ticker + i} opp={opp} isMobile={isMobile} />
          ))}
        </Section>
      )}

      {/* ── Wash-sale warnings ───────────────────────────────────────────── */}
      {data.washSaleWarnings.length > 0 && (
        <Section
          icon={<AlertTriangle size={15} color={colors.warning} />}
          title="Wash-Sale Warnings"
          badge={data.washSaleWarnings.length}
          badgeColor={colors.warning}
          subtitle="IRS may disallow these losses — review with a tax professional"
          isMobile={isMobile}
        >
          {data.washSaleWarnings.map((w, i) => (
            <WashSaleCard key={w.ticker + w.saleDate + i} warning={w} isMobile={isMobile} />
          ))}
        </Section>
      )}

      {/* ── Realized gains table ─────────────────────────────────────────── */}
      {data.realizedGains.length > 0 && (
        <Section
          icon={<CheckCircle size={15} color={colors.success} />}
          title="Realized Gains & Losses"
          badge={data.realizedGains.length}
          badgeColor={colors.textMuted}
          subtitle={`${data.costBasisMethod} basis · ${data.taxYear} tax year`}
          isMobile={isMobile}
          collapsible
          collapsed={!showRealizedTable}
          onToggle={() => setShowRealizedTable(!showRealizedTable)}
        >
          <RealizedGainsTable gains={data.realizedGains} isMobile={isMobile} />
        </Section>
      )}

      {/* ── Legal disclaimer ─────────────────────────────────────────────── */}
      <div style={{
        padding:      '12px 16px',
        borderRadius: radius.md,
        background:   colors.surfaceHover,
        border:       `1px solid ${colors.border}`,
      }}>
        <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, lineHeight: 1.6 }}>
          <strong style={{ color: colors.textSecondary }}>Disclaimer:</strong> Tax calculations
          shown are estimates for informational purposes only and do not constitute tax advice.
          Actual tax obligations depend on your full financial picture. Consult a qualified
          tax professional before making investment decisions. FinSight is not a registered
          investment advisor.
        </p>
      </div>
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, sub, icon, forceNegative = false,
}: {
  label:          string
  value:          number
  sub:            string
  icon:           ReactNode
  forceNegative?: boolean
}) {
  // forceNegative: for "Est. Tax Owed" card — always show as a cost (red)
  const displayValue = forceNegative ? -Math.abs(value) : value
  const isNeg        = displayValue < 0
  const isZero       = displayValue === 0

  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:      '16px',
      boxShadow:    shadow.sm,
    }}>
      <p style={{
        margin: '0 0 8px', fontSize: 11, fontWeight: 600,
        color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{ color: isZero ? colors.textMuted : isNeg ? colors.danger : colors.success }}>
          {icon}
        </span>
        {label}
      </p>
      <p style={{
        margin: '0 0 4px', fontSize: 20, fontWeight: 700,
        color: isZero ? colors.textSecondary : isNeg ? colors.danger : colors.success,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.5px',
      }}>
        {isZero ? '$0.00' : (isNeg ? '−' : '+') + fmtUsd(displayValue)}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: colors.textMuted }}>
        {sub}
      </p>
    </div>
  )
}

// ── Harvest opportunity card ──────────────────────────────────────────────────
function HarvestCard({ opp, isMobile }: { opp: HarvestOpportunity; isMobile: boolean }) {
  const secName = opp.securityName || opp.ticker

  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.md,
      padding:      isMobile ? '14px' : '16px 18px',
      boxShadow:    shadow.xs,
      borderLeft:   `3px solid ${opp.washSaleRisk ? colors.warning : colors.brand}`,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <span style={{
            fontWeight: 700, fontSize: 15, color: colors.text, marginRight: 8,
          }}>{opp.ticker}</span>
          <span style={{ fontSize: 12, color: colors.textMuted }}>{secName !== opp.ticker ? secName : ''}</span>
          <span style={{
            marginLeft: 8,
            fontSize: 10, fontWeight: 700, padding: '2px 6px',
            borderRadius: radius.xs,
            background: opp.shortTerm ? colors.dangerBg : colors.successBg,
            color:      opp.shortTerm ? colors.dangerText : colors.successText,
            letterSpacing: '0.4px',
          }}>
            {opp.shortTerm ? 'SHORT-TERM' : 'LONG-TERM'}
          </span>
          {opp.washSaleRisk && (
            <span style={{
              marginLeft: 6,
              fontSize: 10, fontWeight: 700, padding: '2px 6px',
              borderRadius: radius.xs,
              background: colors.warningBg,
              color:      colors.warningText,
              letterSpacing: '0.4px',
            }}>
              WASH-SALE RISK
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.danger }}>
            −{fmtUsd(opp.unrealizedLoss)}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: colors.textMuted }}>unrealized loss</p>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap',
      }}>
        <Metric label="Current Value" value={fmtUsd(opp.currentValue)} />
        <Metric label="Cost Basis"    value={fmtUsd(opp.costBasis)}    />
        <Metric label="Shares"        value={fmtQty(opp.quantity)}     />
        <Metric
          label="Est. Tax Savings"
          value={fmtUsd(opp.estimatedTaxSavings)}
          valueColor={colors.success}
          bold
        />
      </div>

      {/* Recommendation */}
      <p style={{
        margin: 0, fontSize: 12, color: colors.textSecondary, lineHeight: 1.55,
        padding: '8px 10px', background: colors.surfaceHover,
        borderRadius: radius.sm,
      }}>
        <Scissors size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} color={colors.brand} />
        {opp.recommendation}
      </p>
    </div>
  )
}

// ── Wash-sale warning card ────────────────────────────────────────────────────
function WashSaleCard({ warning, isMobile }: { warning: WashSaleWarning; isMobile: boolean }) {
  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.md,
      padding:      isMobile ? '14px' : '16px 18px',
      boxShadow:    shadow.xs,
      borderLeft:   `3px solid ${colors.warning}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} color={colors.warning} />
          <span style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{warning.ticker}</span>
          {warning.securityName && warning.securityName !== warning.ticker && (
            <span style={{ fontSize: 12, color: colors.textMuted }}>{warning.securityName}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.danger }}>
          −{fmtUsd(warning.lossAmount)}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 8, flexWrap: 'wrap' }}>
        <Metric label="Sale Date"      value={fmtDate(warning.saleDate)}      />
        <Metric label="Related Buy"    value={fmtDate(warning.relatedBuyDate)} />
        <Metric label="Disallowed Loss" value={fmtUsd(warning.lossAmount)} valueColor={colors.danger} bold />
      </div>
      <p style={{
        margin: 0, fontSize: 12, color: colors.warningText, lineHeight: 1.55,
        padding: '8px 10px', background: colors.warningBg,
        borderRadius: radius.sm,
      }}>
        {warning.message}
      </p>
    </div>
  )
}

// ── Realized gains table ──────────────────────────────────────────────────────
function RealizedGainsTable({ gains, isMobile }: { gains: RealizedGainItem[]; isMobile: boolean }) {
  // Aggregate totals
  const totalProceeds  = gains.reduce((s, r) => s + r.proceeds,  0)
  const totalCostBasis = gains.reduce((s, r) => s + r.costBasis, 0)
  const totalGainLoss  = gains.reduce((s, r) => s + r.gainLoss,  0)

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {gains.map((r, i) => (
          <div key={i} style={{
            background:   colors.surface,
            border:       `1px solid ${colors.border}`,
            borderRadius: radius.sm,
            padding:      '12px 14px',
            borderLeft:   `3px solid ${r.gainLoss >= 0 ? colors.success : colors.danger}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{r.ticker}</span>
                <span style={{
                  marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '2px 5px',
                  borderRadius: radius.xs,
                  background: r.longTerm ? colors.successBg : colors.dangerBg,
                  color:      r.longTerm ? colors.successText : colors.dangerText,
                  letterSpacing: '0.3px',
                }}>
                  {r.longTerm ? 'LT' : 'ST'}
                </span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: gainColor(r.gainLoss) }}>
                {signedUsd(r.gainLoss)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>Sold {fmtDate(r.saleDate)}</span>
              <span>Qty {fmtQty(r.quantity)}</span>
              <span>Proceeds {fmtUsd(r.proceeds)}</span>
              <span>Cost {fmtUsd(r.costBasis)}</span>
            </div>
          </div>
        ))}
        {/* Mobile totals */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
          background: colors.surfaceHover, borderRadius: radius.sm,
          fontWeight: 700, fontSize: 13, color: colors.text,
        }}>
          <span>Total ({gains.length} lots)</span>
          <span style={{ color: gainColor(totalGainLoss) }}>{signedUsd(totalGainLoss)}</span>
        </div>
      </div>
    )
  }

  // Desktop table
  const TH = ({ children, align = 'left' }: { children: ReactNode; align?: string }) => (
    <th style={{
      padding: '10px 12px', textAlign: align as 'left' | 'right',
      fontSize: 11, fontWeight: 700, color: colors.textMuted,
      textTransform: 'uppercase', letterSpacing: '0.5px',
      borderBottom: `1px solid ${colors.border}`,
      whiteSpace: 'nowrap',
      background: colors.surfaceHover,
    }}>
      {children}
    </th>
  )

  const TD = ({ children, align = 'left', color }: { children?: ReactNode; align?: string; color?: string }) => (
    <td style={{
      padding: '9px 12px', textAlign: align as 'left' | 'right',
      fontSize: 13, color: color || colors.text,
      borderBottom: `1px solid ${colors.border}`,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {children}
    </td>
  )

  return (
    <div style={{ overflowX: 'auto', borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <TH>Ticker</TH>
            <TH>Type</TH>
            <TH>Qty</TH>
            <TH align="right">Proceeds</TH>
            <TH align="right">Cost Basis</TH>
            <TH align="right">Gain / Loss</TH>
            <TH>Sale Date</TH>
            <TH>Purchase Date</TH>
            <TH>Days Held</TH>
            <TH>Account</TH>
          </tr>
        </thead>
        <tbody>
          {gains.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceHover }}>
              <TD>
                <span style={{ fontWeight: 700 }}>{r.ticker}</span>
                {r.securityName && r.securityName !== r.ticker && (
                  <span style={{ fontSize: 11, color: colors.textMuted, display: 'block' }}>
                    {r.securityName}
                  </span>
                )}
              </TD>
              <TD>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px',
                  borderRadius: radius.xs,
                  background: r.longTerm ? colors.successBg : colors.dangerBg,
                  color:      r.longTerm ? colors.successText : colors.dangerText,
                  letterSpacing: '0.3px',
                }}>
                  {r.longTerm ? 'LONG-TERM' : 'SHORT-TERM'}
                </span>
              </TD>
              <TD>{fmtQty(r.quantity)}</TD>
              <TD align="right">{fmtUsd(r.proceeds)}</TD>
              <TD align="right">{fmtUsd(r.costBasis)}</TD>
              <TD align="right" color={gainColor(r.gainLoss)}>
                <strong>{signedUsd(r.gainLoss)}</strong>
              </TD>
              <TD>{fmtDate(r.saleDate)}</TD>
              <TD>{fmtDate(r.purchaseDate)}</TD>
              <TD>{r.holdingDays.toLocaleString()}</TD>
              <TD>
                <span style={{ fontSize: 11, color: colors.textMuted }}>{r.accountName || '—'}</span>
              </TD>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: colors.surfaceHover }}>
            <TD><strong style={{ color: colors.textSecondary }}>Total ({gains.length} lots)</strong></TD>
            <TD /><TD />
            <TD align="right"><strong>{fmtUsd(totalProceeds)}</strong></TD>
            <TD align="right"><strong>{fmtUsd(totalCostBasis)}</strong></TD>
            <TD align="right" color={gainColor(totalGainLoss)}>
              <strong>{signedUsd(totalGainLoss)}</strong>
            </TD>
            <TD /><TD /><TD /><TD />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Section({
  icon, title, badge, badgeColor, subtitle,
  children, isMobile, collapsible = false, collapsed = false, onToggle,
}: {
  icon:         ReactNode
  title:        string
  badge:        number
  badgeColor:   string
  subtitle:     string
  children:     ReactNode
  isMobile:     boolean
  collapsible?: boolean
  collapsed?:   boolean
  onToggle?:    () => void
}) {
  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:      isMobile ? 16 : 20,
      boxShadow:    shadow.sm,
    }}>
      {/* Section header */}
      <div
        onClick={collapsible ? onToggle : undefined}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: collapsed ? 0 : 14, cursor: collapsible ? 'pointer' : 'default',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            width: 28, height: 28, borderRadius: radius.sm,
            background: colors.surfaceHover,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text }}>
                {title}
              </p>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 7px',
                borderRadius: radius.full,
                background: `${badgeColor}22`,
                color: badgeColor,
              }}>
                {badge}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>
              {subtitle}
            </p>
          </div>
        </div>
        {collapsible && (
          <div style={{ color: colors.textMuted, flexShrink: 0, paddingTop: 2 }}>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
        )}
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Metric({
  label, value, valueColor, bold = false,
}: {
  label:       string
  value:       string
  valueColor?: string
  bold?:       boolean
}) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 10, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: valueColor || colors.text, fontWeight: bold ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted, fontSize: 13 }}>
      Computing tax summary…
    </div>
  )
}

function ErrorState() {
  return (
    <div style={{
      background:   colors.dangerBg,
      border:       `1px solid ${colors.danger}30`,
      borderRadius: radius.lg,
      padding:      '20px 24px',
      textAlign:    'center',
    }}>
      <p style={{ margin: 0, fontSize: 14, color: colors.dangerText, fontWeight: 600 }}>
        Unable to load tax data
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>
        Sync your transactions first, then try again.
      </p>
    </div>
  )
}
