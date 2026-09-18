'use client'

import { cn } from '@/lib/utils'

/**
 * Skeleton loaders for the F1 platform — shimmer-animated placeholders shown
 * while async data (charts, tables, cards) loads.
 */

export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('rounded-lg border border-border/50 bg-card/60 p-4', className)}>
      <div className="space-y-2.5">
        <div className="h-3 w-1/3 rounded bg-zinc-700/40 shimmer" />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-zinc-700/30 shimmer" style={{ width: `${85 - i * 12}%` }} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 p-4 card-hover">
      <div className="h-2.5 w-1/2 rounded bg-zinc-700/40 shimmer mb-2" />
      <div className="h-7 w-2/3 rounded bg-zinc-700/50 shimmer mb-2" />
      <div className="h-2 w-3/4 rounded bg-zinc-700/30 shimmer" />
    </div>
  )
}

export function SkeletonChart({ height = 200 }: { height?: number }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-border/40 bg-background/40" style={{ height }}>
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="space-y-2 w-3/4">
          <div className="h-3 rounded bg-zinc-700/40 shimmer" style={{ width: '70%' }} />
          <div className="h-3 rounded bg-zinc-700/30 shimmer" style={{ width: '85%' }} />
          <div className="h-3 rounded bg-zinc-700/40 shimmer" style={{ width: '60%' }} />
          <div className="h-3 rounded bg-zinc-700/30 shimmer" style={{ width: '90%' }} />
        </div>
      </div>
      <div className="absolute bottom-2 left-2 text-[9px] text-muted-foreground font-mono-nums">loading…</div>
    </div>
  )
}

export function SkeletonRow({ cols = 6 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-zinc-700/30 shimmer"
          style={{ width: `${[20, 35, 25, 15, 12, 18][i % 6]}%` }}
        />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  )
}

/**
 * SkeletonPulse — a generic pulsing dot (used for "live" indicators while loading)
 */
export function SkeletonPulse({ size = 8, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-block rounded-full bg-zinc-600 speed-pulse', className)}
      style={{ width: size, height: size }}
    />
  )
}
