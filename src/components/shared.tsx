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
// Paths use Q (quadratic bezier) + L commands for smooth, recognizable curves.
// Two strokes: thick outer track (gray) + thin inner racing line (red when active).
// Optional corner labels, start/finish line marker, and a progress dot.

type CircuitKey = 'Suzuka' | 'Singapore' | 'Austin' | 'Monaco' | 'Silverstone' | 'Monza' | 'Spa' | 'Zandvoort' | 'unknown'

interface CircuitPathDef {
  d: string
  corners: { x: number; y: number }[]
  start: { x: number; y: number }
}

// Suzuka (5.807 km, 18 corners, figure-8 with crossover).
// Start/finish on main straight (right). S-curves → Degner (down, crosses over)
// → Hairpin (left) → Spoon (up, crosses under) → 130R → Casio → back.
const SUZUKA_PATH: CircuitPathDef = {
  d: 'M 172 128 Q 176 105 173 88 Q 184 74 167 70 Q 152 64 142 66 Q 130 68 120 60 Q 108 52 96 56 Q 86 60 80 70 Q 74 80 70 90 L 56 93 Q 44 96 41 106 Q 39 116 51 117 Q 63 117 67 107 Q 72 97 78 92 Q 92 87 102 82 Q 116 76 124 66 Q 136 54 150 57 Q 164 60 172 68 Q 166 76 173 80 Q 181 84 173 94 Q 170 110 172 128 Z',
  corners: [
    { x: 173, y: 88 }, { x: 167, y: 70 }, { x: 155, y: 66 }, { x: 142, y: 66 },
    { x: 130, y: 64 }, { x: 120, y: 60 }, { x: 108, y: 54 }, { x: 96, y: 56 },
    { x: 82, y: 64 }, { x: 70, y: 90 }, { x: 56, y: 93 }, { x: 41, y: 106 },
    { x: 45, y: 117 }, { x: 67, y: 107 }, { x: 82, y: 92 }, { x: 108, y: 78 },
    { x: 150, y: 57 }, { x: 173, y: 80 },
  ],
  start: { x: 172, y: 128 },
}

// Singapore (Marina Bay, 4.940 km, 19 corners). Street circuit — many 90° turns.
// Start at bottom-left, right along the bottom, up the right side, left along the top
// (Anderson Bridge), back down through the Esplanade section.
const SINGAPORE_PATH: CircuitPathDef = {
  d: 'M 25 120 L 60 120 Q 70 120 70 110 L 70 95 Q 70 85 80 85 L 95 85 Q 105 85 105 75 L 105 55 Q 105 45 115 45 L 135 45 Q 145 45 145 35 L 145 28 Q 145 22 155 22 L 175 22 Q 185 22 185 32 L 185 55 Q 185 65 175 65 L 165 65 Q 155 65 155 75 L 155 90 Q 155 100 145 100 L 125 100 Q 115 100 115 110 L 115 120 Q 115 128 105 128 L 25 128 Q 18 128 18 120 L 18 120 Z',
  corners: [
    { x: 60, y: 120 }, { x: 70, y: 95 }, { x: 70, y: 85 }, { x: 80, y: 85 },
    { x: 95, y: 85 }, { x: 105, y: 75 }, { x: 105, y: 55 }, { x: 105, y: 45 },
    { x: 115, y: 45 }, { x: 135, y: 45 }, { x: 145, y: 35 }, { x: 145, y: 22 },
    { x: 155, y: 22 }, { x: 175, y: 22 }, { x: 185, y: 32 }, { x: 185, y: 55 },
    { x: 175, y: 65 }, { x: 155, y: 75 }, { x: 155, y: 90 },
  ],
  start: { x: 25, y: 120 },
}

// Austin / COTA (5.513 km, 20 corners). T1 uphill left, sweeping esses (T2-T9),
// long back straight, stadium section (T13-T15), final corners.
const AUSTIN_PATH: CircuitPathDef = {
  d: 'M 22 115 Q 26 95 40 88 Q 54 82 48 68 Q 42 54 58 50 Q 74 46 68 34 Q 62 22 80 22 Q 98 22 104 34 Q 110 46 126 42 Q 142 38 156 50 Q 170 62 182 58 Q 190 54 186 68 Q 182 82 172 86 Q 162 90 168 100 Q 174 110 162 114 Q 150 118 136 112 Q 122 106 108 112 Q 94 118 70 116 Q 46 114 22 115 Z',
  corners: [
    { x: 26, y: 95 }, { x: 40, y: 88 }, { x: 48, y: 68 }, { x: 48, y: 54 },
    { x: 58, y: 50 }, { x: 68, y: 34 }, { x: 80, y: 22 }, { x: 98, y: 22 },
    { x: 104, y: 34 }, { x: 110, y: 42 }, { x: 126, y: 42 }, { x: 156, y: 50 },
    { x: 170, y: 62 }, { x: 182, y: 58 }, { x: 186, y: 68 }, { x: 172, y: 86 },
    { x: 168, y: 100 }, { x: 162, y: 114 }, { x: 136, y: 112 }, { x: 108, y: 112 },
  ],
  start: { x: 22, y: 115 },
}

// Monaco (3.337 km, 19 corners). Tight street circuit — Swimming Pool, Loews Hairpin, Tunnel.
const MONACO_PATH: CircuitPathDef = {
  d: 'M 30 120 Q 50 122 60 115 Q 72 108 70 95 Q 68 82 80 78 Q 92 74 90 62 Q 88 50 100 48 Q 115 46 125 38 Q 135 30 150 35 Q 165 40 170 55 Q 175 70 165 80 Q 155 90 160 100 Q 165 110 150 115 Q 130 120 100 118 Q 70 116 50 120 Q 35 122 30 120 Z',
  corners: [
    { x: 50, y: 122 }, { x: 60, y: 115 }, { x: 70, y: 95 }, { x: 72, y: 85 },
    { x: 80, y: 78 }, { x: 90, y: 62 }, { x: 95, y: 50 }, { x: 100, y: 48 },
    { x: 115, y: 46 }, { x: 125, y: 38 }, { x: 135, y: 30 }, { x: 150, y: 35 },
    { x: 165, y: 40 }, { x: 170, y: 55 }, { x: 175, y: 70 }, { x: 165, y: 80 },
    { x: 160, y: 100 }, { x: 150, y: 115 }, { x: 100, y: 118 },
  ],
  start: { x: 30, y: 120 },
}

// Silverstone (5.891 km, 18 corners). Fast flowing — Maggotts/Becketts, Stowe, Club.
const SILVERSTONE_PATH: CircuitPathDef = {
  d: 'M 25 110 Q 35 88 52 80 Q 68 72 62 58 Q 56 44 72 38 Q 88 32 100 42 Q 112 52 128 46 Q 144 40 158 52 Q 172 64 180 56 Q 188 48 182 62 Q 176 76 166 82 Q 156 88 162 100 Q 168 112 154 116 Q 140 120 120 114 Q 100 108 80 112 Q 60 116 40 114 Q 28 112 25 110 Z',
  corners: [
    { x: 35, y: 88 }, { x: 52, y: 80 }, { x: 62, y: 58 }, { x: 72, y: 38 },
    { x: 88, y: 32 }, { x: 100, y: 42 }, { x: 112, y: 52 }, { x: 128, y: 46 },
    { x: 144, y: 40 }, { x: 158, y: 52 }, { x: 172, y: 64 }, { x: 180, y: 56 },
    { x: 182, y: 62 }, { x: 166, y: 82 }, { x: 162, y: 100 }, { x: 154, y: 116 },
    { x: 120, y: 114 }, { x: 80, y: 112 },
  ],
  start: { x: 25, y: 110 },
}

// Monza (5.793 km, 11 corners). High-speed — long straights, Lesmo curves, Ascari chicane.
const MONZA_PATH: CircuitPathDef = {
  d: 'M 30 120 L 80 120 Q 95 120 95 108 L 95 85 Q 95 72 110 70 Q 125 68 125 55 Q 125 42 140 42 Q 155 42 155 55 L 155 80 Q 155 92 170 92 L 180 92 Q 188 92 188 80 L 188 55 Q 188 42 175 38 L 140 38 Q 125 38 120 50 Q 115 62 100 60 Q 85 58 80 70 L 75 85 Q 72 95 60 98 Q 45 100 35 105 Q 25 110 30 120 Z',
  corners: [
    { x: 80, y: 120 }, { x: 95, y: 108 }, { x: 95, y: 85 }, { x: 110, y: 70 },
    { x: 125, y: 55 }, { x: 140, y: 42 }, { x: 155, y: 42 }, { x: 155, y: 80 },
    { x: 170, y: 92 }, { x: 188, y: 80 }, { x: 175, y: 38 },
  ],
  start: { x: 30, y: 120 },
}

// Spa-Francorchamps (7.004 km, 19 corners). Long — Eau Rouge/Raidillon, Pouhon, Bus Stop.
const SPA_PATH: CircuitPathDef = {
  d: 'M 25 115 Q 30 95 42 88 Q 54 80 48 66 Q 42 52 58 45 Q 74 38 85 48 Q 96 58 88 72 Q 80 86 95 90 Q 110 94 120 82 Q 130 70 145 75 Q 160 80 165 65 Q 170 50 155 38 Q 140 26 155 22 Q 170 18 180 30 Q 190 42 182 58 Q 174 74 168 88 Q 162 102 148 108 Q 134 114 110 112 Q 86 110 60 114 Q 42 116 25 115 Z',
  corners: [
    { x: 30, y: 95 }, { x: 42, y: 88 }, { x: 48, y: 66 }, { x: 58, y: 45 },
    { x: 74, y: 38 }, { x: 85, y: 48 }, { x: 96, y: 58 }, { x: 88, y: 72 },
    { x: 95, y: 90 }, { x: 110, y: 94 }, { x: 120, y: 82 }, { x: 130, y: 70 },
    { x: 145, y: 75 }, { x: 165, y: 65 }, { x: 170, y: 50 }, { x: 155, y: 38 },
    { x: 155, y: 22 }, { x: 180, y: 30 }, { x: 182, y: 58 },
  ],
  start: { x: 25, y: 115 },
}

// Zandvoort (4.259 km, 14 corners). Banking — Hugenholtz, Arie Luyendyk, Scheivlak.
const ZANDVOORT_PATH: CircuitPathDef = {
  d: 'M 30 115 Q 40 95 55 88 Q 70 80 65 66 Q 60 52 75 48 Q 90 44 100 55 Q 110 66 125 60 Q 140 54 155 64 Q 170 74 175 60 Q 180 46 168 38 Q 156 30 140 35 Q 125 40 110 35 Q 95 30 80 38 Q 65 46 50 50 Q 35 54 28 68 Q 22 82 25 95 Q 28 108 30 115 Z',
  corners: [
    { x: 40, y: 95 }, { x: 55, y: 88 }, { x: 65, y: 66 }, { x: 75, y: 48 },
    { x: 90, y: 44 }, { x: 100, y: 55 }, { x: 125, y: 60 }, { x: 140, y: 54 },
    { x: 155, y: 64 }, { x: 175, y: 60 }, { x: 180, y: 46 }, { x: 168, y: 38 },
    { x: 140, y: 35 }, { x: 80, y: 38 },
  ],
  start: { x: 30, y: 115 },
}

// Fallback: generic closed loop with 8 corners.
const UNKNOWN_PATH: CircuitPathDef = {
  d: 'M 100 22 Q 140 28 170 58 Q 182 88 160 112 Q 120 128 75 122 Q 32 112 22 82 Q 18 52 50 32 Q 75 22 100 22 Z',
  corners: [
    { x: 100, y: 22 }, { x: 140, y: 28 }, { x: 170, y: 58 }, { x: 182, y: 88 },
    { x: 160, y: 112 }, { x: 120, y: 128 }, { x: 75, y: 122 }, { x: 32, y: 112 },
  ],
  start: { x: 100, y: 22 },
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
