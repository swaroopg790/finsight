import { useEffect, useRef, useState } from 'react'

/**
 * Animates a numeric value from 0 to `target` using an ease-out cubic curve.
 * Re-triggers whenever `target` changes.
 *
 * @param target   The destination number.
 * @param duration Animation duration in milliseconds (default 900ms).
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue]   = useState(0)
  const startRef            = useRef<number | null>(null)
  const startValueRef       = useRef(0)
  const rafRef              = useRef<number>(0)

  useEffect(() => {
    if (target === 0) {
      setValue(0)
      return
    }

    startRef.current      = null
    startValueRef.current = 0   // always animate from 0 on mount / target change

    function step(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp

      const elapsed  = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic: decelerate toward end
      const eased = 1 - Math.pow(1 - progress, 3)

      setValue(startValueRef.current + (target - startValueRef.current) * eased)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
