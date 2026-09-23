'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Driver, SessionSummary } from '@/lib/types'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { useCountUp } from '@/hooks/use-count-up'
import { SkeletonStatCard } from '@/components/skeletons'

// ---- helpers ----

export function fmtLapTime(ms: number): string {
  if (!ms && ms !== 0) return '—'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function fmtDelta(ms: number): string {
  const sign = ms > 0 ? '+' : ''
  const s = (ms / 1000).toFixed(3)
  return `${sign}${s}`
}

// ---- StatCard ----

export function StatCard({
  label,
  value,
  unit,
  sub,
  accent = 'default',
  icon,
  spark,
  loading,
  animate = true,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  accent?: 'default' | 'red' | 'amber' | 'emerald' | 'rose'
  icon?: React.ReactNode
  spark?: number[]
  loading?: boolean
  animate?: boolean
}) {
  const accentClasses: Record<string, string> = {
    default: 'text-foreground',
    red: 'text-red-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
  }
  const sparkColor: Record<string, string> = {
    default: '#e5e5e5',
    red: '#f87171',
    amber: '#fbbf24',
    emerald: '#34d399',
    rose: '#fb7185',
  }
  // animated count-up for numeric values
  const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''))
  const isNumeric = typeof value === 'number' || (!isNaN(numValue) && /^[\d.,]+$/.test(String(value)))
  const animated = useCountUp(isNumeric ? numValue : 0, { duration: 700, enabled: animate && isNumeric })

  if (loading) return <SkeletonStatCard />

  const displayValue = isNumeric
    ? (Number.isInteger(numValue)
        ? Math.round(animated).toLocaleString()
        : animated.toFixed(String(value).includes('.') ? (String(value).split('.')[1]?.length ?? 1) : 1))
    : String(value)

  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur p-4 card-hover group">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className={cn('mt-1 font-mono-nums text-2xl font-bold leading-none transition-transform group-hover:scale-[1.02] origin-left', accentClasses[accent])}>
            {displayValue}
            {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
          </div>
          {sub && <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{sub}</div>}
        </div>
        {icon && <div className="shrink-0 text-muted-foreground transition-colors group-hover:text-red-400">{icon}</div>}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-2 h-8 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor[accent]} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={sparkColor[accent]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="v" stroke={sparkColor[accent]} strokeWidth={1.5} fill={`url(#spark-${accent})`} isAnimationActive={false} />
              <YAxis hide domain={['dataMin', 'dataMax']} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

// ---- DriverChip ----

export function DriverChip({ driver, size = 'sm' }: { driver: Driver; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono-nums',
        size === 'sm' ? 'text-[11px]' : 'text-xs px-2 py-1',
        driver.isRival
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
          : 'border-red-500/50 bg-red-500/10 text-red-300'
      )}
    >
      <span className="font-bold">{driver.code}</span>
      <span className="text-muted-foreground hidden sm:inline">#{driver.number}</span>
    </span>
  )
}

// ---- SessionBadge ----

const sessionStyle: Record<string, string> = {
  FP1: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  FP2: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  FP3: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  Q: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  RACE: 'border-red-500/50 bg-red-500/10 text-red-300',
}

export function SessionBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className={cn('font-mono-nums font-bold', sessionStyle[type] ?? sessionStyle.FP1)}>
      {type}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    live: 'border-red-500/50 bg-red-500/15 text-red-300 pulse-red',
    scheduled: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400',
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    running: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    pending: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400',
    failed: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
    rolled_back: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400',
    active: 'border-red-500/50 bg-red-500/10 text-red-300',
    acknowledged: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    resolved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    healthy: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    armed: 'border-amber-500/50 bg-amber-500/10 text-amber-300 blink',
  }
  return (
    <Badge variant="outline" className={cn('font-medium', map[status] ?? map.scheduled)}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

// ---- SectionHeader ----

export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

// ---- CircuitTrack mini SVG (stylised) ----

export function MiniTrack({ corners, active = false }: { corners: number; active?: boolean }) {
  // Procedurally draw a closed loop track
  const pts: string[] = []
  const n = Math.max(corners, 8)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 22 + Math.sin(i * 1.7) * 8
    const x = 50 + Math.cos(a) * r
    const y = 50 + Math.sin(a) * r * 0.7
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return (
    <svg viewBox="0 0 100 70" className={cn('w-full h-full', active && 'drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]')}>
      <polygon
        points={pts.join(' ')}
        fill="none"
        stroke={active ? '#f87171' : '#52525b'}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <polygon points={pts.join(' ')} fill="none" stroke={active ? '#fca5a5' : '#71717a'} strokeWidth={1} />
    </svg>
  )
}

// ---- TrackMap (REAL circuit SVG paths from julesr0y/f1-circuits-svg) ----
// Accurate SVG path data sourced from https://github.com/julesr0y/f1-circuits-svg
// viewBox 0 0 500 500. Two strokes: thick outer track + thin inner racing line.

type CircuitKey = 'Suzuka' | 'Singapore' | 'Austin' | 'Monaco' | 'Silverstone' | 'Monza' | 'Spa' | 'Zandvoort' | 'unknown'

interface CircuitPathDef {
  d: string
  start: { x: number; y: number }
}

const SUZUKA_PATH: CircuitPathDef = {
  d: 'M214.902 264.546c-4.263.328-5.803-.797-6.964-6.36-1.16-5.565-10.35-52.063-12.284-61.7-1.12-5.576-.962-14.257 1.644-19.872 2.999-6.458 5.822-12.607 7.255-15.698 1.836-3.975.773-6.955-2.322-8.247-2.978-1.244-5.03-.101-7.35 4.074-2.322 4.173-12.672 21.262-15.283 25.733-2.153 3.687-8.92 17.507-26.309 19.871-10.163 1.38-19.687 1.207-28.146-.199-7.964-1.324-15.005-3.757-20.119-6.358-17.369-8.84-26.889-12.917-38.592-41.034-6.216-14.93-8.706-20.865-9.866-24.045s-6.259-10.384-16.25-9.637c-5.32.397-8.334.725-13.348 1.987-9.865 2.484-14.279 11.485-11.026 20.368 3.675 10.035 7.145 12.684 21.666 23.845 27.276 20.965 40.187 27.009 54.455 33.086 18.664 7.949 100.496 37.755 115.585 42.823 8.293 2.785 13.156 3.078 23.89-1.69 14.312-6.358 24.468-14.207 34.047-24.242 9.108-9.546 20.215-18.976 30.565-27.522 3.32-2.742 4.453-1.049 5.706.199 3 2.98 3.77 3.676 5.32 4.967 1.752 1.463 2.812 1.8 4.836.1 2.128-1.789 6.544-5.557 7.643-6.258 8.992-5.762 12.435-7.209 19.143-5.619q2.56.607 5.23 1.446c13.93 4.372 17.894 8.247 32.694 25.634 8.66 10.175 94.452 116.714 100.98 124.992 7.834 9.934 7.94 13.91 6.482 23.744-1.546 10.433-6.74 21.182-17.704 19.971-8.994-.993-11.294-7.23-14.509-12.32-3.577-5.663-9.067-15.082-13.154-21.461-5.028-7.85-5.807-13.238-19.345-13.91-14.025-.695-19.964-2.105-23.407-17.685-.967-4.372-1.38-5.691-3.289-12.32-2.513-8.744-8.513-14.227-18.764-13.811-14.702.596-23.273-2.344-27.661-12.519-3.772-8.743-.236-15.137 1.933-20.765 1.837-4.77 6.382-16.195 2.71-23.35-3.676-7.153-7.966-9.22-12.866-11.524-5.707-2.683-17.812-8.054-30.855-6.757-14.994 1.49-27.083 9.837-35.207 20.17-6.979 8.877-17.12 21.656-19.442 24.839-2.321 3.181-3.96 3.926-6.287 4.173-6.577.693-23.699 2.285-31.435 2.881z',
  start: { x: 214.902, y: 264.546 },
}

const SINGAPORE_PATH: CircuitPathDef = {
  d: 'M461.432 325.308c3.546.215 6.228-.46 8.285-3.467 2.658-3.883 10.644-15.694 13.506-20.689 2.248-3.924 1.906-8.228 1.362-12.25-.547-4.022-21.779-162.674-22.394-167.042-.55-3.905-2.982-6.455-8.02-5.625-5.037.832-10.535.682-15.509-2.08-5.826-3.236-7.566-5.548-9.382-9.324-2.012-4.185-5.031-6.738-7.791-6.78-4.919-.079-7.416 3.389-7.87 6.78-.944 7.05-1.516 14.7-1.89 19.263-.454 5.547.59 16.212 1.816 20.65s6.726 21.596 9.38 32.207c2.657 10.608 5.068 21.644 6.355 28.2 1.816 9.246-5.447 26.66-19.82 25.58-16.56-1.243-96.96-6.878-104.994-7.571-7.76-.67-17.023-1.387-24.511-4.784-9.874-4.479-92.876-54.296-99.618-58.388-4.267-2.589-5.307-2.724-7.762 1.528-11.374 19.692-20.682 35.827-31.12 56.305-1.838 3.606-3.541 4.266-6.334 1.284-4.19-4.477-26.419-27.808-32.683-34.534-5.78-6.204-20.57-6.21-25.67 4.612-6.504 13.799-56.755 104.28-59.206 108.974-1.382 2.644-2.983 6.481-2.427 10.392.47 3.318 2.756 6.781 5.287 8.641 3.575 2.63 8.469 6.402 12.552 9.457 2.35 1.759 5.615 2.859 10.003 3.783 3.281.692 4.549 2.145 4.69 10.942.077 4.74.304 10.324.304 14.178 0 5.64 3.442 6.28 6.278 8.59 8.916 7.264 16.457 13.176 21.79 17.106 1.07.79 6.672 4.662 8.285 7.396 3.404 5.78 5.447 8.784 7.15 11.096 2.722 3.694 7.75 2.688 8.625-2.08 1.93-10.519 14.526-87.49 17.477-105.29.646-3.9 2.514-10.388 3.065-11.788.098-.25 17.789-43.744 18.355-45.218.646-1.68 1.17-2.659 1.277-2.918 1.153-2.766 3.802-3.986 7.49-.75 5.372 4.713 45.155 39.55 51.182 44.959 5.529 4.963 13.647 8.282 20.848 8.815 5.82.43 8.613.617 15.24 1.124 4.085.313 5.41 1.675 5.22 6.703-.16 4.285-.454 6.935-.568 10.518-.227 7.166 7.468 15.472 13.618 15.718 5.789.232 46.78 2.22 52.09 2.428 3.884.152 5.952-1.327 7.378-6.24 2.043-7.052 4.755-16.077 5.674-20.342.819-3.796 3.138-4.937 5.789-4.739 6.945.52 33.591 2.45 36.656 2.66 3.065.208 6.168 2.429 6.128 6.819-.114 12.367 4.654 19.533 14.98 20.457 5.9.524 74.87 4.457 79.434 4.734z',
  start: { x: 461.432, y: 325.308 },
}

const AUSTIN_PATH: CircuitPathDef = {
  d: 'M463.201 42.551c-3.095-4.166-9.585-4.959-13.542-1.491-105.774 92.51-189.942 140.467-271.342 186.844l-1.43.818a8.79 8.79 0 0 0-4.448 7.319 8.87 8.87 0 0 0 3.861 7.726c10.004 6.86 18.037 11.893 24.491 15.937 9.44 5.913 15.39 9.643 19.06 13.81l-12.113 5.437c-1.335.598-2.524.903-3.537.903-1.238 0-2.939-.402-5.131-3.54l-4.563-6.535a13.1 13.1 0 0 0-5.448-4.483l-11.76-5.206a13.07 13.07 0 0 0-9.396-.459l-11.38 3.769c-3.1 1.023-5.339 3.555-5.99 6.772a9.12 9.12 0 0 0 2.897 8.64c6.81 5.996 14.065 10.876 21.083 15.595 7.814 5.256 15.205 10.224 20.324 15.78 1.003 1.77 5.673 10.775 4.745 22.995a9.66 9.66 0 0 1-2.139 5.317c-3.422 4.198-9.976 11.888-15.405 16.219a9.1 9.1 0 0 1-3.476 1.72c-2.734.69-8.336 1.847-15.156 1.847a58 58 0 0 1-9.102-.709c-.999-.161-2.029-.56-3.066-1.183l-47.373-28.484c-5.617-3.377-13.355-2.265-17.802 2.544l-48.214 52.06a10.69 10.69 0 0 0-2.47 10.18c1 3.624 3.746 6.404 7.344 7.44l211.465 60.794c.8.23 1.623.349 2.44.349h.004c3.202 0 6.146-1.782 7.68-4.652 1.537-2.871 1.379-6.22-.42-8.954-4.86-7.388-12.923-18.609-23.722-30.107-15.686-16.704-17.69-29.534-6.913-44.286 8.675-11.876 21.268-28.367 28.003-37.141a19.36 19.36 0 0 0 4.016-11.282l.466-15.142a19.58 19.58 0 0 1 6.562-14.018l.715-.63c7.37-6.527 10.504-16.54 8.18-26.134l-3.371-13.905c-.474-1.951-.171-4.007.844-5.789 2.62-4.578 8.053-13.095 15.02-18.7 1.572-1.26 3.69-1.957 5.968-1.957l26.805 1.295.957.022c8.28 0 15.724-5.263 18.53-13.093l8.343-23.295c1.584-4.427 5.797-7.398 10.481-7.398 1.941 0 3.789.498 5.5 1.482l7.665 4.404c3.18 1.826 7.308 1.64 10.303-.463l40.179-28.161a14.04 14.04 0 0 0 5.38-7.511L464.63 50.736c.84-2.853.317-5.836-1.428-8.185z',
  start: { x: 463.201, y: 42.551 },
}

const MONACO_PATH: CircuitPathDef = {
  d: 'M114.39 254.118c-5.291.797-16.59 3.899-21.591 12.351-10.241 17.32-7.564 49.849-7.225 65.52.449 21.233 8.19 64.394 15.81 89.16 3.615 11.749 7.831 22.293 13.03 31.103 2.953 5.01 6.138 10.317 9.024 14.801 2.655 4.132 6.263 10.877.24 15.999-4.558 3.875-9.64 1.203-14.008-3.463-3.42-3.657-10.543-14.16-16.567-29.37-9.765-24.66-17.468-50.031-19.732-61.9-3.01-15.815-5.578-37.213-6.624-51.21-1.514-20.246-1.259-37.462.905-48.948.636-3.383 6.686-25.199 7.828-30.577 3.014-14.157 5.074-12.608 9.76-13.832 11.628-3.034 24.635-3.212 33.918-4.69 10.391-1.656 27.932-4.627 34.64-6.63 8.586-2.558 24.114-7.437 37.654-9.638 12.048-1.957 22.442-3.163 33.738-8.585 6.376-3.06 22.44-11.446 29.22-13.556 6.776-2.106 19.262-4.742 26.505-6.324 8.285-1.808 17.729-3.209 24.701-4.667 9.595-2.01 25.857-13.498 28.267-28.719 2.61-16.465-2.639-25.304-13.255-34.742-7.23-6.426-11.998-11.999-13.052-15.915-2.046-7.596.486-12.732 3.914-17.468 5.12-7.08 52.114-70.035 55.578-74.403 3.465-4.37 6.626-3.766 10.243-.905 3.612 2.863 7.632 5.591 7.23 10.695-.452 5.722-.53 10.242 1.81 14.007 2.707 4.368 3.46 5.272 6.776 9.79 2.199 2.998 4.066 5.874 5.272 9.79 1.13 3.669 6.282 5.293 9.185 2.71 2.708-2.41 3.163-6.779-.902-9.79-1.685-1.247-3.686-2.58-5.423-5.271-3.013-4.67-5.576-8.133-7.38-10.996-1.43-2.267-3.222-11.35 2.86-13.104 8.888-2.56 20.184-6.025 26.055-7.832 2.798-.86 11.448-.15 11.448 8.585s-.302 18.374-1.201 26.658c-.408 3.704-3.586 49.104-22.845 79.876-23.814 38.04-64.113 65.337-72.997 70.287-20.183 11.245-40.852 18.48-47.896 20.282-12.954 3.313-29.117 4.617-43.98 6.628-1.799.242-4.12.2-5.425 3.062-1.083 2.374-2.923 3.206-4.768 3.514-8.131 1.356-15.674 2.176-20.535 2.862-15.662 2.206-89.21 13.2-100.205 14.854z',
  start: { x: 114.39, y: 254.118 },
}

const SILVERSTONE_PATH: CircuitPathDef = {
  d: 'M195.761 247.012c2.65-3.621 2.45-9.073-1.143-11.827-.985-.756-4.246-2.917-10.125-7.616-2.025-1.618-3.07-3.718-3.386-8.418a56836.548 56388.169 0 0 0-3.592-52.948c-.63-9.231 3.133-17.45 11.605-22.454 5.622-3.32 17.745-11.375 29.236-19.147 3.838-2.596 8.509-7.627 9.25-13.366.65-5.024-2.241-10.75-4.245-13.772-4.083-6.157-9.642-14.092-15.352-22.36-6.042-8.749-18.127-5.022-18.944 4.375-.816 9.398-.899 12.315-1.306 17.985-.25 3.466-7.266 17.717-20.74 12.8-14.209-5.185-7.879-20.646-7.325-21.701 7.289-13.886 15.623-29.211 20.505-37.048 9.58-15.378 25.704-25.296 39.407-26.584 18.918-1.78 76.238-6.805 105.635-9.258 2.916-.243 5.556-.498 7.862-.65 7.843-.516 21.346 4.846 24.828 16.658 8.165 27.706 12.927 43.496 14.332 67.407 1.268 21.603 2.42 42.276 2.652 49.736.278 8.92 1.883 13.375 9.635 24.627.68.984 1.461 2.099 2.315 3.333 2.182 3.148 3.237 7.36-.246 16.434-3.793 9.88-9.555 20.467-9.146 29.812.546 12.475 4.326 13.683 9.364 19.66 10.017 11.882 7.185 25.707-4.621 32.755-4.322 2.58-8.563 4.969-12.364 7.211-9.436 5.57-13.513 9.501-18.29 19.28-12.957 26.518-83.893 152.682-99.076 173.203-12.588 17.013-38.433 10.532-43.659-6.643-1.42-4.666-16.259-30.393-20.577-34.403-10.234-9.505-16.766-16.417-20.25-21.17-3.42-4.668-7.676-9.398-13.882-17.337-2.815-3.6-6.621-5.117-10.615-.81-7.513 8.101-8.982 9.56-16.478 8.671-2.76-.326-4.747-1.608-6.723-3.493l-5.65-5.395c-10.545-10.067-10.043-28.776 1.414-43.746 10.997-14.365 52.26-67.725 59.228-76.475 4.452-5.589 13.118-17.28 20.467-27.326z',
  start: { x: 195.761, y: 247.012 },
}

const MONZA_PATH: CircuitPathDef = {
  d: 'M224.27 47.46c15.977-1.36 26.445-1.909 37.569-3.021 14.496-1.45 32.133-7.973 45.42-11.597 13.289-3.624 34.067-10.51 49.046-17.274 5.814-2.625 19.086 2.778 20.053 15.1.966 12.321 3.292 35.876 3.745 42.884.483 7.49.02 8.58-4.228 10.872-9.181 4.953-33.803 18.277-43.005 23.798-13.893 8.335-27.262 16.663-35.999 24.28-9.422 8.215-68.85 60.134-74.976 65.595-11.114 9.906-24.322 25.368-25.772 40.348-.494 5.114-19.723 184.684-21.502 199.683-.938 7.907-2.658 24.442-4.107 36.844-1.16 9.933-9.033 11.293-14.658 9.825-11.113-2.899-14.818-3.383-28.347-7.41-5.745-1.709-8.517-5.727-7.731-13.529 2.094-20.777 30.43-340.956 31.89-356.724 1.683-18.172 7.37-36.481 31.65-49.165 13.217-6.904 23.92-9.06 40.952-10.51z',
  start: { x: 224.27, y: 47.46 },
}

const SPA_PATH: CircuitPathDef = {
  d: 'M167.75 20.858c-3.075-5.364-.283-7.034 3.387-5.065 3.669 1.97 49.393 30.95 55.603 35.171 6.21 4.22 10.613 8.816 14.395 13.224 6.116 7.128 29.072 34.701 33.87 40.235 2.327 2.682 4.765 5.265 8.892 6.504.742.223 1.542.375 2.398.53 3.105.563 9.733 2.517 14.112 9.848 4.987 8.348 5.552 11.818 4.705 22.04-.49 5.916.164 11.615 2.258 14.631 5.08 7.316 15.721 22.54 22.956 32.545 8.75 12.099 16.935 28.98 20.322 40.235s41.49 144.622 43.467 152.5c1.975 7.878 4.009 9.705-5.504 15.334-4.516 2.673-8.435 6.431-6.774 13.787 1.27 5.628 9.744 26.446.846 32.639-2.08 1.447-48.41 32.702-57.014 38.265-5.222 3.377-12.385.885-15.242-4.08-2.856-4.964-3.503-11.631 4.093-15.897 5.927-3.329 9.314-5.205 25.685-14.96 3.995-2.38 6.181-7.751 3.198-14.442-2.634-5.909-7.55-20.755-9.972-27.574-5.645-15.897-10.43-48.422-14.254-69.216-1.552-8.44-7.338-16.882-19.193-18.007-2.61-.248-11.29-.844-18.77-.563-7.303.275-20.816 4.787-27.66 22.79-5.08 13.366-15.524 40.095-23.992 62.464-6.59 17.407-22.297 12.661-24.696 10.832-5.53-4.215-19.68-14.49-31.19 1.688-5.503 7.738-16.934 26.59-23.567 36.86-7.403 11.462-15.806 3.657-38.81-13.506-9.759-7.282-7.215-21.806-5.786-27.293 6.586-25.285 18.77-40.094 31.189-50.786s29.919-23.353 50.805-30.669c20.887-7.315 27.2-13.496 33.023-24.197 16.23-29.825 24.133-42.908 22.44-57.54-1.694-14.63-19.053-43.752-22.722-56.413-2.69-9.285-4.774-32.872-5.249-52.615-.083-3.47-.676-7.138 6.096-6.19 10.725 1.5 7.765-7.127 6.21-9.379-7.904-11.442-11.323-16.99-17.782-28.324-7.057-12.38-39.515-71.467-41.773-75.406z',
  start: { x: 167.75, y: 20.858 },
}

const ZANDVOORT_PATH: CircuitPathDef = {
  d: 'M21.069 357.833c1.298-3.172 2.643-6.403 4.005-9.703 39.95-96.747 102.157-247.306 119.655-289.933 3.898-9.5 13.163-13.63 23.395-9.5 7.133 2.878 10.938 7.388 12.269 15.545 1.314 8.052-2.023 13.112-5.136 22.264-4.375 12.858-8.062 21.928-13.314 34.737-4.565 11.131-8.748 22.264-9.13 36.082-.372 13.554-.299 18.144-.57 23.607-.57 11.515-4.946 18.903-18.07 23.797-11.036 4.116-19.445 6.953-26.765 9.625-1.385.507-21.738 7.073-16.317 23.482 6.249 18.915 23.516 12.476 24.897 12.061 15.203-4.553 47.601-15.05 61.552-19.45 10.043-3.166 34.618-2.687 52.782 1.92 11.556 2.929 31.293 9.03 49.644 9.5 18.735.48 49.833-20.823 58.678-27.156 8.845-6.334 25.772-12.533 39.469-11.994 21.969.863 51.066 3.037 60.96 3.742 13.506.96 37.51 9.447 43.938 33.01 5.706 20.919-1.52 36.273-8.178 46.158-8.541 12.678-20.542 29.076-26.249 40.016-3.437 6.589-12.174 24.375-19.503 39.417-4.837 9.93-9.028 16.623-32.613 14.32-11.761-1.15-36.85-4.875-62.578-28.019-8.75-7.87-7.989-18.233-4.755-22.07 6.896-8.183 14.836-12.283 23.396-13.434 21.706-2.92 24.918-2.303 53.638-13.243 13.996-5.329 17.746-17.038 15.788-27.636-2.093-11.325-9.892-17.658-23.777-19.577-42.12-5.824-79.576-3.528-110.13 2.304-42.225 8.06-79.517 23.968-116.977 43.373-14.076 7.294-15.977-1.727-20.16-10.364-3.746-7.729-11.831-9.875-19.213-7.87-9.89 2.688-12.487 9.57-11.601 15.162 2.853 18.04 16.166 95.962 20.16 117.456 3.164 17.024-2.852 36.465-27.77 37.234-15.79.488-29.415.122-50.785-2.879-15.026-2.11-34.119-17.863-40.896-34.546-4.754-11.709-10.841-30.324.26-57.438Z',
  start: { x: 21.069, y: 357.833 },
}

const UNKNOWN_PATH: CircuitPathDef = {
  d: 'M250 50 C300 50 400 100 400 200 C400 350 350 400 250 400 C150 400 100 350 100 250 C100 150 150 100 250 50 Z',
  start: { x: 250, y: 50 },
}

const CIRCUIT_PATHS: Record<CircuitKey, CircuitPathDef> = {
  Suzuka: SUZUKA_PATH,
  Singapore: SINGAPORE_PATH,
  Austin: AUSTIN_PATH,
  Monaco: MONACO_PATH,
  Silverstone: SILVERSTONE_PATH,
  Monza: MONZA_PATH,
  Spa: SPA_PATH,
  Zandvoort: ZANDVOORT_PATH,
  unknown: UNKNOWN_PATH,
}

function resolveCircuit(name: string): CircuitKey {
  const n = (name ?? '').toLowerCase()
  if (n.includes('suzuka')) return 'Suzuka'
  if (n.includes('singapore') || n.includes('marina')) return 'Singapore'
  if (n.includes('austin') || n.includes('americas') || n.includes('cota')) return 'Austin'
  if (n.includes('monaco')) return 'Monaco'
  if (n.includes('silverstone')) return 'Silverstone'
  if (n.includes('monza')) return 'Monza'
  if (n.includes('spa') || n.includes('francorchamps')) return 'Spa'
  if (n.includes('zandvoort')) return 'Zandvoort'
  return 'unknown'
}

/**
 * getCornerPoints — returns corner positions for the given circuit.
 * With real bezier SVG paths, we don't have explicit corner coordinates,
 * so this returns an empty array. The track SHAPE is accurate from the path data.
 */
export function getCornerPoints(circuitName: string): { x: number; y: number; num: number }[] {
  return []
}

export function TrackMap({
  circuitName,
  size = 120,
  showLabels = false,
  active = false,
  progress,
  className,
}: {
  circuitName: string
  size?: number
  showLabels?: boolean
  active?: boolean
  progress?: number
  className?: string
}) {
  const key = resolveCircuit(circuitName)
  const circuit = CIRCUIT_PATHS[key]
  const racingLine = active ? '#f87171' : '#71717a'
  const height = size // square viewBox 0 0 500 500

  return (
    <svg
      viewBox="0 0 500 500"
      width={size}
      height={height}
      className={cn('block', active && 'drop-shadow-[0_0_12px_rgba(248,113,113,0.5)]', className)}
      role="img"
      aria-label={`${circuitName} circuit map`}
    >
      {/* Outer track surface (gray, thick) */}
      <path
        d={circuit.d}
        fill="none"
        stroke="#3f3f46"
        strokeWidth={12}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Inner racing line (colored, thin) */}
      <path
        d={circuit.d}
        fill="none"
        stroke={racingLine}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Start/finish line — small checkered rect at the first point */}
      <rect
        x={circuit.start.x - 6}
        y={circuit.start.y - 3}
        width={12}
        height={6}
        fill="#fafafa"
        stroke="#18181b"
        strokeWidth={1}
      />
      {progress != null && (
        <circle
          cx={circuit.start.x}
          cy={circuit.start.y}
          r={6}
          fill="#f87171"
          stroke="#ffffff"
          strokeWidth={2}
          style={{ filter: 'drop-shadow(0 0 6px rgba(248,113,113,0.9))' }}
        />
      )}
    </svg>
  )
}

// ---- Channel group color ----

export function channelColor(group: string): string {
  const map: Record<string, string> = {
    brakes: '#f87171',
    suspension: '#fbbf24',
    aero: '#34d399',
    engine: '#fb923c',
    power_unit: '#e879f9',
  }
  return map[group] ?? '#a1a1aa'
}
