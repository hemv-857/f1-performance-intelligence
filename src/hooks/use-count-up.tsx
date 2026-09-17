'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * useCountUp — animates a number from its previous value to the target.
 * Uses requestAnimationFrame with an ease-out cubic curve.
 *
 * Respects `prefers-reduced-motion` (jumps to target instantly).
 *
 * Usage:
 *   const display = useCountUp(targetValue, { duration: 700 })
 *   <span className="font-mono-nums">{display.toFixed(2)}</span>
 */
export function useCountUp(
  target: number,
  opts?: { duration?: number; enabled?: boolean }
): number {
  const { duration = 700, enabled = true } = opts ?? {}
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  // respect reduced motion — derive during render, no setState needed
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!enabled || prefersReducedMotion) {
      // no animation — just snap (use a microtask to avoid render-phase setState)
      if (display !== target) {
        // schedule outside of render
        const id = setTimeout(() => setDisplay(target), 0)
        return () => clearTimeout(id)
      }
      return
    }
    fromRef.current = display
    startRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const animate = (ts: number) => {
      if (startRef.current == null) startRef.current = ts
      const elapsed = ts - startRef.current
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = fromRef.current + (target - fromRef.current) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(target)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, enabled, prefersReducedMotion])

  return enabled ? display : target
}

/**
 * CountUp — a drop-in component that animates a number from 0 to `value`.
 * Renders a <span> with the formatted number.
 */
export function CountUp({
  value,
  duration = 700,
  decimals,
  suffix,
  prefix,
  className,
  enabled = true,
}: {
  value: number
  duration?: number
  decimals?: number
  suffix?: string
  prefix?: string
  className?: string
  enabled?: boolean
}) {
  const display = useCountUp(value, { duration, enabled })
  const dec = decimals ?? (Number.isInteger(value) ? 0 : Math.max(0, (String(value).split('.')[1] ?? '').length))
  return (
    <span className={className}>
      {prefix}{display.toFixed(dec)}{suffix}
    </span>
  )
}
