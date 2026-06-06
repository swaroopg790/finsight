import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely — drop conflicting utilities */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format currency with tabular numerals */
export function fmtCurrency(value: number, decimals = 2): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `$${(value / 1_000).toFixed(1)}K`
  return '$' + value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Format percentage with sign */
export function fmtPct(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/** Delta class names */
export function deltaClass(value: number): string {
  if (value > 0)  return 'delta-positive'
  if (value < 0)  return 'delta-negative'
  return 'delta-neutral'
}

/** Relative time string */
export function relativeTime(isoUtc: string): string {
  try {
    const ms = Date.now() - new Date(isoUtc).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days === 1) return 'Yesterday'
    if (days < 7)  return `${days}d ago`
    return new Date(isoUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}
