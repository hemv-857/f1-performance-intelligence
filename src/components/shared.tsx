'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Driver, SessionSummary } from '@/lib/types'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'

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
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  accent?: 'default' | 'red' | 'amber' | 'emerald' | 'rose'
  icon?: React.ReactNode
  spark?: number[]
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
  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className={cn('mt-1 font-mono-nums text-2xl font-bold leading-none', accentClasses[accent])}>
            {value}
            {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
          </div>
          {sub && <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{sub}</div>}
        </div>
        {icon && <div className="shrink-0 text-muted-foreground">{icon}</div>}
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
