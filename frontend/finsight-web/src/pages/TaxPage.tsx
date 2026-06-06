import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Calculator, TrendingUp,
  AlertTriangle, Scissors, ChevronDown, ChevronUp,
  CheckCircle, Info,
} from 'lucide-react'
import api               from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { cn }            from '../lib/utils'

// ── API response types ─────────────────────────────────────────────────────────
interface RealizedGainItem {
  ticker: string; securityName: string | null; quantity: number
  proceeds: number; costBasis: number; gainLoss: number; longTerm: boolean
  saleDate: string; purchaseDate: string; holdingDays: number; accountName: string | null
}
interface HarvestOpportunity {
  ticker: string; securityName: string | null; quantity: number; currentValue: number
  costBasis: number; unrealizedLoss: number; estimatedTaxSavings: number
  shortTerm: boolean; washSaleRisk: boolean; recommendation: string
}
interface WashSaleWarning {
  ticker: string; securityName: string | null; saleDate: string
  relatedBuyDate: string; lossAmount: number; message: string
}
interface TaxSummaryResponse {
  taxYear: number; costBasisMethod: string
  shortTermRealizedGains: number; longTermRealizedGains: number; totalRealizedGains: number
  shortTermUnrealizedGains: number; longTermUnrealizedGains: number; totalUnrealizedGains: number
  estimatedTaxOwed: number; shortTermTaxRate: number; longTermTaxRate: number
  daysRemainingInYear: number; yearEndAdvice: string
  totalHarvestableLosses: number; estimatedHarvestSavings: number
  realizedGains: RealizedGainItem[]; harvestOpportunities: HarvestOpportunity[]; washSaleWarnings: WashSaleWarning[]
}
type BasisMethod = 'FIFO' | 'LIFO' | 'HIGHEST_COST'

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtUsd  = (v: number) => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtQty  = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const signedUsd = (v: number) => (v >= 0 ? '+' : '−') + fmtUsd(v)
const gainCls   = (v: number) => v >= 0 ? 'text-emerald-400' : 'text-red-400'

// ── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, icon, forceNegative = false }: {
  label: string; value: number; sub: string; icon: ReactNode; forceNegative?: boolean
}) {
  const displayValue = forceNegative ? -Math.abs(value) : value
  const isNeg  = displayValue < 0
  const isZero = displayValue === 0
  return (
    <div className="glass rounded-xl p-4">
      <p className={cn('label-xs flex items-center gap-1.5 mb-2',
        isZero ? '' : isNeg ? 'text-red-400/70' : 'text-emerald-400/70')}>
        {icon} {label}
      </p>
      <p className={cn('text-xl font-bold font-nums tracking-tight',
        isZero ? 'text-slate-400' : isNeg ? 'text-red-400' : 'text-emerald-400')}>
        {isZero ? '$0.00' : (isNeg ? '−' : '+') + fmtUsd(displayValue)}
      </p>
      <p className="text-slate-600 text-xs mt-1">{sub}</p>
    </div>
  )
}

// ── Metric ─────────────────────────────────────────────────────────────────────
function Metric({ label, value, valueColor, bold = false }: {
  label: string; value: string; valueColor?: string; bold?: boolean
}) {
  return (
    <div>
      <p className="label-xs mb-0.5">{label}</p>
      <p className={cn('text-sm font-nums', bold ? 'font-bold' : 'font-medium', valueColor ? '' : 'text-slate-200')}
        style={valueColor ? { color: valueColor } : {}}>
        {value}
      </p>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ icon, title, badge, badgeClass, subtitle, children, collapsible = false, collapsed = false, onToggle }: {
  icon: ReactNode; title: string; badge: number; badgeClass: string; subtitle: string
  children: ReactNode; collapsible?: boolean; collapsed?: boolean; onToggle?: () => void
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div
        onClick={collapsible ? onToggle : undefined}
        className={cn('flex items-start justify-between gap-3 flex-wrap', collapsed ? 'mb-0' : 'mb-4', collapsible && 'cursor-pointer')}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">{icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white font-semibold text-sm">{title}</p>
              <span className={cn('text-2xs font-bold px-2 py-0.5 rounded-full', badgeClass)}>{badge}</span>
            </div>
            <p className="text-slate-500 text-xs">{subtitle}</p>
          </div>
        </div>
        {collapsible && (
          <div className="text-slate-500 shrink-0 pt-0.5">
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
        )}
      </div>
      {!collapsed && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  )
}

// ── Harvest card ──────────────────────────────────────────────────────────────
function HarvestCard({ opp }: { opp: HarvestOpportunity }) {
  return (
    <div className={cn('glass-sm rounded-xl p-4 border-l-2',
      opp.washSaleRisk ? 'border-l-amber-500' : 'border-l-indigo-500')}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-sm">{opp.ticker}</span>
          {opp.securityName && opp.securityName !== opp.ticker && <span className="text-slate-500 text-xs">{opp.securityName}</span>}
          <span className={cn('text-2xs font-bold px-2 py-0.5 rounded-full',
            opp.shortTerm ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400')}>
            {opp.shortTerm ? 'SHORT-TERM' : 'LONG-TERM'}
          </span>
          {opp.washSaleRisk && <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">WASH-SALE RISK</span>}
        </div>
        <div className="text-right">
          <p className="text-red-400 font-bold text-base font-nums">−{fmtUsd(opp.unrealizedLoss)}</p>
          <p className="text-slate-600 text-xs">unrealized loss</p>
        </div>
      </div>
      <div className="flex gap-4 flex-wrap mb-3">
        <Metric label="Current Value"    value={fmtUsd(opp.currentValue)} />
        <Metric label="Cost Basis"       value={fmtUsd(opp.costBasis)} />
        <Metric label="Shares"           value={fmtQty(opp.quantity)} />
        <Metric label="Est. Tax Savings" value={fmtUsd(opp.estimatedTaxSavings)} valueColor="#10b981" bold />
      </div>
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 text-xs text-slate-400 flex items-start gap-2">
        <Scissors size={11} className="text-indigo-400 shrink-0 mt-0.5" />
        {opp.recommendation}
      </div>
    </div>
  )
}

// ── Wash sale card ─────────────────────────────────────────────────────────────
function WashSaleCard({ warning }: { warning: WashSaleWarning }) {
  return (
    <div className="glass-sm rounded-xl p-4 border-l-2 border-l-amber-500">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="text-white font-bold text-sm">{warning.ticker}</span>
          {warning.securityName && warning.securityName !== warning.ticker && (
            <span className="text-slate-500 text-xs">{warning.securityName}</span>
          )}
        </div>
        <p className="text-red-400 font-bold text-sm font-nums">−{fmtUsd(warning.lossAmount)}</p>
      </div>
      <div className="flex gap-4 flex-wrap mb-3">
        <Metric label="Sale Date"      value={fmtDate(warning.saleDate)} />
        <Metric label="Related Buy"    value={fmtDate(warning.relatedBuyDate)} />
        <Metric label="Disallowed Loss" value={fmtUsd(warning.lossAmount)} valueColor="#ef4444" bold />
      </div>
      <div className="bg-amber-500/[0.06] border border-amber-500/10 rounded-lg px-3 py-2 text-xs text-amber-300">
        {warning.message}
      </div>
    </div>
  )
}

// ── Realized gains table ───────────────────────────────────────────────────────
function RealizedGainsTable({ gains, isMobile }: { gains: RealizedGainItem[]; isMobile: boolean }) {
  const totalProceeds  = gains.reduce((s, r) => s + r.proceeds,  0)
  const totalCostBasis = gains.reduce((s, r) => s + r.costBasis, 0)
  const totalGainLoss  = gains.reduce((s, r) => s + r.gainLoss,  0)

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {gains.map((r, i) => (
          <div key={i} className={cn('glass-sm rounded-xl p-3 border-l-2',
            r.gainLoss >= 0 ? 'border-l-emerald-500' : 'border-l-red-500')}>
            <div className="flex justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">{r.ticker}</span>
                <span className={cn('text-2xs font-bold px-1.5 py-0.5 rounded', r.longTerm ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                  {r.longTerm ? 'LT' : 'ST'}
                </span>
              </div>
              <span className={cn('font-bold text-sm font-nums', gainCls(r.gainLoss))}>{signedUsd(r.gainLoss)}</span>
            </div>
            <div className="flex gap-3 flex-wrap text-xs text-slate-500">
              <span>Sold {fmtDate(r.saleDate)}</span>
              <span>Qty {fmtQty(r.quantity)}</span>
              <span>Proceeds {fmtUsd(r.proceeds)}</span>
            </div>
          </div>
        ))}
        <div className="flex justify-between px-3 py-2 bg-white/[0.02] rounded-lg text-sm font-bold text-slate-300">
          <span>Total ({gains.length} lots)</span>
          <span className={cn('font-nums', gainCls(totalGainLoss))}>{signedUsd(totalGainLoss)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            {['Ticker','Type','Qty','Proceeds','Cost Basis','Gain / Loss','Sale Date','Purchase Date','Days','Account'].map((h, i) => (
              <th key={h} className={cn('px-3 py-2.5', i >= 3 && i <= 5 ? 'text-right' : 'text-left')}>
                <span className="label-xs">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gains.map((r, i) => (
            <tr key={i} className={cn('border-b border-white/[0.04] hover:bg-white/[0.02]', i % 2 === 0 ? '' : 'bg-white/[0.01]')}>
              <td className="px-3 py-2.5">
                <span className="text-slate-200 font-bold text-xs">{r.ticker}</span>
                {r.securityName && r.securityName !== r.ticker && <span className="text-slate-600 text-2xs block">{r.securityName}</span>}
              </td>
              <td className="px-3 py-2.5">
                <span className={cn('text-2xs font-bold px-1.5 py-0.5 rounded', r.longTerm ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                  {r.longTerm ? 'LONG-TERM' : 'SHORT-TERM'}
                </span>
              </td>
              <td className="px-3 py-2.5 text-slate-400 text-xs font-nums">{fmtQty(r.quantity)}</td>
              <td className="px-3 py-2.5 text-right text-slate-300 text-xs font-nums">{fmtUsd(r.proceeds)}</td>
              <td className="px-3 py-2.5 text-right text-slate-400 text-xs font-nums">{fmtUsd(r.costBasis)}</td>
              <td className={cn('px-3 py-2.5 text-right text-xs font-bold font-nums', gainCls(r.gainLoss))}>{signedUsd(r.gainLoss)}</td>
              <td className="px-3 py-2.5 text-slate-400 text-xs">{fmtDate(r.saleDate)}</td>
              <td className="px-3 py-2.5 text-slate-400 text-xs">{fmtDate(r.purchaseDate)}</td>
              <td className="px-3 py-2.5 text-slate-500 text-xs">{r.holdingDays.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-slate-600 text-xs">{r.accountName || '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-white/[0.03]">
            <td className="px-3 py-2.5 text-slate-300 font-bold text-xs" colSpan={3}>Total ({gains.length} lots)</td>
            <td className="px-3 py-2.5 text-right text-slate-200 font-bold text-xs font-nums">{fmtUsd(totalProceeds)}</td>
            <td className="px-3 py-2.5 text-right text-slate-200 font-bold text-xs font-nums">{fmtUsd(totalCostBasis)}</td>
            <td className={cn('px-3 py-2.5 text-right font-bold text-xs font-nums', gainCls(totalGainLoss))}>{signedUsd(totalGainLoss)}</td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TaxPage() {
  const { isMobile } = useBreakpoint()
  const currentYear  = new Date().getFullYear()

  const [year,   setYear]   = useState(currentYear)
  const [method, setMethod] = useState<BasisMethod>('FIFO')
  const [showRealizedTable, setShowRealizedTable] = useState(false)

  const { data, isLoading, isError } = useQuery<TaxSummaryResponse>({
    queryKey: ['tax', year, method],
    queryFn:  () => api.get(`/tax/summary?year=${year}&method=${method}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Calculator size={15} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tax Intelligence</h1>
        </div>
        <p className="text-slate-500 text-sm ml-11">
          Realized gains · Tax-loss harvesting · Wash-sale alerts · Year-end planning
        </p>
      </motion.div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex gap-1">
          {[currentYear - 1, currentYear].map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={cn('text-xs px-3.5 py-1.5 rounded-lg border transition-all',
                year === y ? 'bg-indigo-600 border-indigo-600 text-white font-bold' : 'border-white/[0.08] text-slate-500 hover:text-slate-300')}>
              {y}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs font-medium">Cost basis:</span>
          {(['FIFO', 'LIFO', 'HIGHEST_COST'] as BasisMethod[]).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={cn('text-2xs px-2.5 py-1.5 rounded-lg border transition-all font-semibold',
                method === m ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400' : 'border-white/[0.06] text-slate-500 hover:text-slate-300')}>
              {m === 'HIGHEST_COST' ? 'High Cost' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : isError || !data ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
          <p className="text-red-400 text-sm font-semibold mb-1">Unable to load tax data</p>
          <p className="text-slate-500 text-xs">Connect a brokerage and sync transactions first.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 stagger-children">
          {/* Year-end advice */}
          {data.yearEndAdvice && (
            <div className="flex items-start gap-3 bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl px-4 py-3">
              <Info size={15} className="text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-slate-300 text-sm leading-relaxed">{data.yearEndAdvice}</p>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Short-Term Gains" value={data.shortTermRealizedGains}
              sub={`Taxed at ${(data.shortTermTaxRate * 100).toFixed(0)}%`}
              icon={<TrendingUp size={13} />} />
            <SummaryCard label="Long-Term Gains"  value={data.longTermRealizedGains}
              sub={`Taxed at ${(data.longTermTaxRate * 100).toFixed(0)}%`}
              icon={<TrendingUp size={13} />} />
            <SummaryCard label="Unrealized P&L"   value={data.totalUnrealizedGains}
              sub="Current positions" icon={<Calculator size={13} />} />
            <SummaryCard label="Est. Tax Owed"    value={-data.estimatedTaxOwed}
              sub={`Based on ${data.taxYear} activity`}
              icon={<AlertTriangle size={13} />} forceNegative />
          </div>

          {/* No activity */}
          {data.realizedGains.length === 0 && data.totalUnrealizedGains === 0 && data.harvestOpportunities.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center">
              <Calculator size={28} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-semibold mb-1">No tax activity for {data.taxYear}</p>
              <p className="text-slate-600 text-xs">Connect a brokerage and sync transactions to see your tax picture.</p>
            </div>
          )}

          {/* Harvest opportunities */}
          {data.harvestOpportunities.length > 0 && (
            <Section icon={<Scissors size={14} className="text-indigo-400" />}
              title="Tax-Loss Harvesting Opportunities"
              badge={data.harvestOpportunities.length} badgeClass="bg-indigo-500/15 text-indigo-400"
              subtitle={`~${fmtUsd(data.estimatedHarvestSavings)} potential savings · ${data.daysRemainingInYear} days left in ${data.taxYear}`}>
              {data.harvestOpportunities.map((opp, i) => <HarvestCard key={opp.ticker + i} opp={opp} />)}
            </Section>
          )}

          {/* Wash-sale warnings */}
          {data.washSaleWarnings.length > 0 && (
            <Section icon={<AlertTriangle size={14} className="text-amber-400" />}
              title="Wash-Sale Warnings"
              badge={data.washSaleWarnings.length} badgeClass="bg-amber-500/15 text-amber-400"
              subtitle="IRS may disallow these losses — review with a tax professional">
              {data.washSaleWarnings.map((w, i) => <WashSaleCard key={w.ticker + w.saleDate + i} warning={w} />)}
            </Section>
          )}

          {/* Realized gains table */}
          {data.realizedGains.length > 0 && (
            <Section icon={<CheckCircle size={14} className="text-emerald-400" />}
              title="Realized Gains & Losses"
              badge={data.realizedGains.length} badgeClass="bg-white/[0.06] text-slate-400"
              subtitle={`${data.costBasisMethod} basis · ${data.taxYear} tax year`}
              collapsible collapsed={!showRealizedTable} onToggle={() => setShowRealizedTable(!showRealizedTable)}>
              <RealizedGainsTable gains={data.realizedGains} isMobile={isMobile} />
            </Section>
          )}

          {/* Disclaimer */}
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3">
            <p className="text-slate-600 text-xs leading-relaxed">
              <strong className="text-slate-500">Disclaimer:</strong> Tax calculations shown are estimates for
              informational purposes only and do not constitute tax advice. Actual tax obligations depend on
              your full financial picture. Consult a qualified tax professional. FinSight is not a registered investment advisor.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
