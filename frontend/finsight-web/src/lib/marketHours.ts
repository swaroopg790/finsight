/**
 * Market hours utilities — NYSE / Nasdaq schedule.
 *
 * US markets are open Monday–Friday, 09:30–16:00 Eastern Time.
 * This is used to gate live-price polling: we only refetch holdings
 * during market hours to avoid burning API credits overnight.
 *
 * Note: holidays are not handled (they're rare and a missed poll is harmless).
 */

/** IANA timezone identifier for New York / Eastern Time (handles DST automatically). */
const ET = 'America/New_York'

/**
 * Returns true if the current moment falls within NYSE trading hours:
 *   Monday–Friday, 09:30–16:00 Eastern Time.
 */
export function isMarketOpen(): boolean {
  const now = new Date()

  // Get current time in Eastern Time
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone:   ET,
    weekday:    'short',
    hour:       'numeric',
    minute:     'numeric',
    hour12:     false,
  }).formatToParts(now)

  const parts = Object.fromEntries(etParts.map((p) => [p.type, p.value]))
  const weekday = parts['weekday']   // 'Mon', 'Tue', ... 'Sun'
  const hour    = parseInt(parts['hour'],   10)
  const minute  = parseInt(parts['minute'], 10)

  // Skip weekends
  if (weekday === 'Sat' || weekday === 'Sun') return false

  // Market opens at 09:30 ET
  const afterOpen  = hour > 9  || (hour === 9  && minute >= 30)
  // Market closes at 16:00 ET
  const beforeClose = hour < 16 || (hour === 16 && minute === 0)

  return afterOpen && beforeClose
}

/**
 * Returns the polling interval in milliseconds for live price updates.
 *   - During market hours: 30 seconds
 *   - Outside market hours: false (polling disabled)
 *
 * Pass this to React Query's refetchInterval option.
 */
export function liveRefetchInterval(): number | false {
  return isMarketOpen() ? 30_000 : false
}
