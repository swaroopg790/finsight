import { useEffect, useState } from 'react'

/** px width at which the layout switches from desktop → tablet → mobile */
export const BP_MOBILE = 640
export const BP_TABLET = 1024

interface Breakpoint {
  isMobile: boolean  // < 640px
  isTablet: boolean  // < 1024px (includes mobile)
  width:    number
}

/**
 * Reactive window-width breakpoint hook.
 * Returns stable { isMobile, isTablet, width } that updates on every resize.
 * SSR-safe: defaults to desktop (1024) when window is unavailable.
 */
export function useBreakpoint(): Breakpoint {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : BP_TABLET
  )

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize, { passive: true })
    // Sync immediately in case width changed before effect ran
    setWidth(window.innerWidth)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return {
    isMobile: width < BP_MOBILE,
    isTablet: width < BP_TABLET,
    width,
  }
}
