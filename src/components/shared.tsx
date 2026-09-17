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
  const isNumeric = typeof value === 'number' || (!isNaN(numValue) && String(value).match(/^[\d.,]+$/))
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

// ---- TrackMap (realistic per-circuit SVG) ----
// Hand-crafted SVG path data for each circuit. viewBox 0 0 200 140.
// Two strokes: thick outer track (gray) + thin inner racing line (red when active).
// Optional corner labels, start/finish line marker, and a progress dot.

type CircuitKey = 'Suzuka' | 'Singapore' | 'Austin' | 'unknown'

interface CircuitPathDef {
  d: string
  corners: { x: number; y: number }[]
  start: { x: number; y: number }
}

// Suzuka (figure-8 with crossover) — corners 1-18.
// The descending Degner segment (T9->T10) and the ascending Spoon segment
// (T13->T14) geometrically cross near (75, 57.5), giving the iconic figure-8.
const SUZUKA_PATH: CircuitPathDef = {
  d: 'M 175 110 L 175 90 L 170 75 L 175 65 L 165 58 L 170 50 L 155 40 L 135 32 L 110 35 L 80 50 L 60 80 L 45 90 L 50 80 L 50 70 L 90 50 L 110 55 L 130 60 L 150 68 L 165 80 L 170 95 Z',
  corners: [
    { x: 175, y: 90 }, { x: 170, y: 75 }, { x: 175, y: 65 }, { x: 165, y: 58 },
    { x: 170, y: 50 }, { x: 155, y: 40 }, { x: 135, y: 32 }, { x: 110, y: 35 },
    { x: 80, y: 50 }, { x: 60, y: 80 }, { x: 45, y: 90 }, { x: 50, y: 80 },
    { x: 50, y: 70 }, { x: 90, y: 50 }, { x: 110, y: 55 }, { x: 130, y: 60 },
    { x: 150, y: 68 }, { x: 165, y: 80 },
  ],
  start: { x: 175, y: 110 },
}

// Singapore (Marina Bay street circuit) — 19 corners, mostly 90°.
const SINGAPORE_PATH: CircuitPathDef = {
  d: 'M 30 115 L 30 95 L 55 95 L 55 75 L 75 75 L 75 55 L 100 55 L 100 35 L 140 35 L 140 50 L 155 50 L 155 35 L 175 35 L 175 60 L 165 60 L 165 80 L 145 80 L 145 100 L 120 100 L 120 115 L 30 115 Z',
  corners: [
    { x: 30, y: 95 }, { x: 55, y: 95 }, { x: 55, y: 75 }, { x: 75, y: 75 },
    { x: 75, y: 55 }, { x: 100, y: 55 }, { x: 100, y: 35 }, { x: 140, y: 35 },
    { x: 140, y: 50 }, { x: 155, y: 50 }, { x: 155, y: 35 }, { x: 175, y: 35 },
    { x: 175, y: 60 }, { x: 165, y: 60 }, { x: 165, y: 80 }, { x: 145, y: 80 },
    { x: 145, y: 100 }, { x: 120, y: 100 }, { x: 120, y: 115 },
  ],
  start: { x: 30, y: 115 },
}

// Austin (Circuit of the Americas) — 20 corners. Sweeping sector-1 esses,
// long back straight, tight stadium section.
const AUSTIN_PATH: CircuitPathDef = {
  d: 'M 25 110 L 28 95 L 42 85 L 48 70 L 62 65 L 68 52 L 82 50 L 88 38 L 102 38 L 108 28 L 125 32 L 140 45 L 165 50 L 175 70 L 165 82 L 175 92 L 160 100 L 145 96 L 132 105 L 105 108 L 60 112 Z',
  corners: [
    { x: 28, y: 95 }, { x: 42, y: 85 }, { x: 48, y: 70 }, { x: 62, y: 65 },
    { x: 68, y: 52 }, { x: 82, y: 50 }, { x: 88, y: 38 }, { x: 102, y: 38 },
    { x: 108, y: 28 }, { x: 125, y: 32 }, { x: 140, y: 45 }, { x: 165, y: 50 },
    { x: 175, y: 70 }, { x: 165, y: 82 }, { x: 175, y: 92 }, { x: 160, y: 100 },
    { x: 145, y: 96 }, { x: 132, y: 105 }, { x: 105, y: 108 }, { x: 60, y: 112 },
  ],
  start: { x: 25, y: 110 },
}

// Fallback: generic closed loop with 8 corners.
const UNKNOWN_PATH: CircuitPathDef = {
  d: 'M 100 20 L 145 30 L 175 65 L 170 105 L 135 125 L 80 125 L 30 105 L 25 65 L 55 30 Z',
  corners: [
    { x: 100, y: 20 }, { x: 145, y: 30 }, { x: 175, y: 65 }, { x: 170, y: 105 },
    { x: 135, y: 125 }, { x: 80, y: 125 }, { x: 30, y: 105 }, { x: 25, y: 65 },
  ],
  start: { x: 100, y: 20 },
}

const CIRCUIT_PATHS: Record<CircuitKey, CircuitPathDef> = {
  Suzuka: SUZUKA_PATH,
  Singapore: SINGAPORE_PATH,
  Austin: AUSTIN_PATH,
  unknown: UNKNOWN_PATH,
}

function resolveCircuit(name: string): CircuitKey {
  const n = (name ?? '').toLowerCase()
  if (n.includes('suzuka')) return 'Suzuka'
  if (n.includes('singapore') || n.includes('marina')) return 'Singapore'
  if (n.includes('austin') || n.includes('americas') || n.includes('cota')) return 'Austin'
  return 'unknown'
}

/**
 * getCornerPoints — returns the (x, y) SVG coordinates (viewBox 0 0 200 140)
 * of every corner apex for the given circuit, along with the 1-indexed
 * corner number. Used by the Deep-Dive Track Delta Map to overlay colored
 * per-sector delta dots on top of the `<TrackMap>` SVG.
 */
export function getCornerPoints(circuitName: string): { x: number; y: number; num: number }[] {
  const key = resolveCircuit(circuitName)
  const circuit = CIRCUIT_PATHS[key]
  return circuit.corners.map((c, i) => ({ x: c.x, y: c.y, num: i + 1 }))
}

// Compute the (x, y) point at parametric position t (0..1) along the path
// start -> corners[0] -> ... -> corners[N-1] -> start (closed loop).
// Because every segment of our path `d` is a straight `L` command, this
// linear walk is exact — no DOM measurement needed.
function pointAtProgress(
  start: { x: number; y: number },
  corners: { x: number; y: number }[],
  t: number,
): { x: number; y: number } | null {
  if (corners.length === 0) return null
  const verts: { x: number; y: number }[] = [start, ...corners, start]
  const segs: { a: { x: number; y: number }; b: { x: number; y: number }; len: number }[] = []
  let total = 0
  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i]
    const b = verts[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    segs.push({ a, b, len })
    total += len
  }
  if (total === 0) return start
  let dist = total * Math.max(0, Math.min(1, t))
  for (const s of segs) {
    if (dist <= s.len) {
      const f = s.len === 0 ? 0 : dist / s.len
      return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f }
    }
    dist -= s.len
  }
  return start
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
  const progressPoint =
    progress != null ? pointAtProgress(circuit.start, circuit.corners, progress) : null

  const racingLine = active ? '#f87171' : '#71717a'
  const height = (size * 140) / 200

  return (
    <svg
      viewBox="0 0 200 140"
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
        strokeWidth={8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Inner racing line (colored, thin) */}
      <path
        d={circuit.d}
        fill="none"
        stroke={racingLine}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Start/finish line — small checkered rect at the first point */}
      <rect
        x={circuit.start.x - 3}
        y={circuit.start.y - 1.5}
        width={6}
        height={3}
        fill="#fafafa"
        stroke="#18181b"
        strokeWidth={0.5}
      />
      {showLabels &&
        circuit.corners.map((c, i) => (
          <g key={i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={3.2}
              fill="#18181b"
              stroke={active ? '#f87171' : '#a1a1aa'}
              strokeWidth={1}
            />
            <text
              x={c.x}
              y={c.y + 1.1}
              textAnchor="middle"
              fontSize={4}
              fontWeight={700}
              fill={active ? '#fca5a5' : '#d4d4d8'}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {i + 1}
            </text>
          </g>
        ))}
      {progressPoint && (
        <circle
          cx={progressPoint.x}
          cy={progressPoint.y}
          r={4}
          fill="#f87171"
          stroke="#ffffff"
          strokeWidth={1.2}
          style={{ filter: 'drop-shadow(0 0 4px rgba(248,113,113,0.9))' }}
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
