'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket'
import { useAppStore } from '@/lib/store'
import { StatCard, SectionHeader, StatusBadge } from '@/components/shared'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  Timer, Fuel, TrendingDown, GitBranch, Calculator, Gauge, Trophy,
  AlertTriangle, CircleCheck, Disc, ChevronRight, Flame, Snowflake,
} from 'lucide-react'
import {
  ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, Legend,
} from 'recharts'

// ---- tire-degradation model ----
// Per-lap lap-time delta (ms) vs a fresh tire, as a function of tire age (laps).
// Soft: high initial grip, fast deg; cliff ~lap 12.
// Medium: balanced; cliff ~lap 20.
// Hard: slow deg; cliff ~lap 30.
const BASE_OFFSET_MS = 25
const CLIFF_LAP: Record<Compound, number> = { soft: 12, medium: 20, hard: 30 }
const COMPOUND_COLOR: Record<Compound, string> = {
  soft: '#f87171',
  medium: '#fbbf24',
  hard: '#a1a1aa',
}
const COMPOUND_BG: Record<Compound, string> = {
  soft: 'bg-red-500/15 text-red-300 border-red-500/40',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  hard: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
}
type Compound = 'soft' | 'medium' | 'hard'

function degSoft(age: number) { return BASE_OFFSET_MS + 0.8 * Math.pow(age, 1.4) }
function degMedium(age: number) { return BASE_OFFSET_MS + 0.45 * Math.pow(age, 1.15) }
function degHard(age: number) { return BASE_OFFSET_MS + 0.28 * Math.pow(age, 1.05) }

// Optimal pit windows (lap ranges) per compound — typical stint length
// before the cliff kicks in.
const PIT_WINDOWS: { compound: Compound; start: number; end: number }[] = [
  { compound: 'soft', start: 8, end: 14 },
  { compound: 'medium', start: 16, end: 24 },
  { compound: 'hard', start: 26, end: 36 },
]

// Hardcoded plausible race strategies (Singapore-like, 62-lap race).
interface Strategy {
  id: string
  name: string
  stops: number[]
  compounds: Compound[]
  projectedDelta: number // seconds vs theoretical optimum
  risk: 'LOW' | 'MED' | 'HIGH'
  note: string
}
const STRATEGIES: Strategy[] = [
  {
    id: 's1',
    name: '1-stop · Medium → Hard',
    stops: [22],
    compounds: ['medium', 'hard'],
    projectedDelta: 12.3,
    risk: 'LOW',
    note: 'Conservative. Single stop fits the medium window, hard to end. Lowest traffic risk.',
  },
  {
    id: 's2',
    name: '2-stop · Soft → Medium → Soft',
    stops: [14, 32],
    compounds: ['soft', 'medium', 'soft'],
    projectedDelta: 8.7,
    risk: 'HIGH',
    note: 'Aggressive. Two soft stints exploit warm-track grip but demand clean air & traffic mgmt.',
  },
  {
    id: 's3',
    name: '2-stop · Medium → Soft → Soft',
    stops: [20, 38],
    compounds: ['medium', 'soft', 'soft'],
    projectedDelta: 9.4,
    risk: 'MED',
    note: 'Balanced. Medium stabilises early, two soft stints for closing pace. Vulnerable to SC timing.',
  },
]

const PACE_PENALTY: Record<'slow' | 'normal' | 'push', number> = {
  slow: 2.0,
  normal: 1.0,
  push: 0.3,
}
const TIRE_WARMUP_LOSS = 0.5 // s — fixed warm-up penalty on out-lap
const RIVAL_PIT_DELTA_LAPS = 2 // rival pits 2 laps later

const FUEL_BUDGET_KG = 110

// ============================================================
// StrategyView
// ============================================================

export function StrategyView({ socket }: { socket: ReturnType<typeof useTelemetrySocket> }) {
  const { sessions, selectedSessionId } = useAppStore()

  // Prefer the live session, fall back to the selected one.
  const liveSession = sessions.find((s) => s.status === 'live')
  const activeSession = liveSession ?? sessions.find((s) => s.id === selectedSessionId) ?? sessions[0] ?? null
  const sessionId = activeSession?.id ?? null

  const detailQ = useQuery({
    queryKey: ['session-detail', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}`)
      if (!r.ok) throw new Error('session fetch failed')
      return r.json()
    },
  })

  // Race lap count: from the circuit's race distance if known, else fallback to 53.
  const raceLapCount = useMemo(() => {
    const lc = (detailQ.data?.session?.circuit?.lapCount as number | undefined) ?? null
    if (lc && lc > 0) return lc
    // session may be Q/FP — derive from circuit name if known
    if (activeSession?.circuit?.name?.toLowerCase().includes('singapore')) return 62
    if (activeSession?.circuit?.name?.toLowerCase().includes('suzuka')) return 53
    return 53
  }, [detailQ.data, activeSession])

  // Average lap time across all valid laps in the session (ms).
  const avgLapMs = useMemo(() => {
    const drivers = detailQ.data?.session?.drivers ?? []
    const laps = drivers.flatMap((d: any) => d.laps ?? [])
    const valid = laps.filter((l: any) => l.isValid && l.lapTimeMs > 0)
    if (valid.length === 0) return null
    const sum = valid.reduce((s: number, l: any) => s + l.lapTimeMs, 0)
    return Math.round(sum / valid.length)
  }, [detailQ.data])

  // Compound usage tally (for context badge).
  const compoundUsage = useMemo(() => {
    const drivers = detailQ.data?.session?.drivers ?? []
    const laps = drivers.flatMap((d: any) => d.laps ?? [])
    const tally: Record<string, number> = { soft: 0, medium: 0, hard: 0 }
    for (const l of laps) {
      const c = (l.tireCompound ?? '').toLowerCase()
      if (c in tally) tally[c]++
    }
    const total = tally.soft + tally.medium + tally.hard
    return { tally, total }
  }, [detailQ.data])

  const airTemp = activeSession?.airTemp ?? detailQ.data?.session?.airTemp ?? null
  const trackTemp = activeSession?.trackTemp ?? detailQ.data?.session?.trackTemp ?? null
  const circuitName = activeSession?.circuit?.name ?? detailQ.data?.session?.circuit?.name ?? '—'
  const trackLength = activeSession?.circuit?.trackLength ?? detailQ.data?.session?.circuit?.trackLength ?? null

  const projectedRaceMs = avgLapMs ? avgLapMs * raceLapCount : null

  // Current live lap (tire age proxy) from TSU's tick stream.
  const currentLap = socket.ticks['TSU']?.lap ?? 1
  const clampedCurrentLap = Math.max(1, Math.min(raceLapCount, currentLap))

  return (
    <div className="space-y-4">
      {/* ============ Section 1: race context header ============ */}
      <RaceContextCard
        circuitName={circuitName}
        trackLength={trackLength}
        raceLapCount={raceLapCount}
        avgLapMs={avgLapMs}
        projectedRaceMs={projectedRaceMs}
        airTemp={airTemp}
        trackTemp={trackTemp}
        sessionType={activeSession?.type ?? null}
        sessionStatus={activeSession?.status ?? null}
        compoundUsage={compoundUsage}
        loading={detailQ.isLoading}
      />

      {/* ============ Section 2: tire-age projection chart ============ */}
      <TireAgeProjectionCard
        raceLapCount={raceLapCount}
        currentLap={clampedCurrentLap}
      />

      {/* ============ Section 3: pit-stop window planner ============ */}
      <PitWindowPlannerCard raceLapCount={raceLapCount} />

      {/* ============ Section 4: undercut simulator ============ */}
      <UndercutSimulatorCard raceLapCount={raceLapCount} currentLap={clampedCurrentLap} />

      {/* ============ Section 5: live tire temps strip ============ */}
      <LiveTireTempsCard socket={socket} />
    </div>
  )
}

// ============================================================
// Section 1: Race context header card
// ============================================================

function RaceContextCard({
  circuitName, trackLength, raceLapCount, avgLapMs, projectedRaceMs,
  airTemp, trackTemp, sessionType, sessionStatus, compoundUsage, loading,
}: {
  circuitName: string
  trackLength: number | null
  raceLapCount: number
  avgLapMs: number | null
  projectedRaceMs: number | null
  airTemp: number | null
  trackTemp: number | null
  sessionType: string | null
  sessionStatus: string | null
  compoundUsage: { tally: Record<string, number>; total: number }
  loading: boolean
}) {
  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur p-4 card-hover">
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/50 bg-red-500/15 text-red-300">
                STRATEGY · RACE PLANNING
              </Badge>
              {sessionType && <Badge variant="outline" className="font-mono-nums text-[10px]">{sessionType}</Badge>}
              {sessionStatus && <StatusBadge status={sessionStatus} />}
              <span className="text-[11px] text-muted-foreground font-mono-nums">
                {loading ? 'LOADING SESSION…' : 'SESSION LOADED'}
              </span>
            </div>
            <h2 className="text-lg font-bold mt-1.5 flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-red-400" />
              {circuitName}
              {trackLength != null && (
                <span className="text-sm font-normal text-muted-foreground font-mono-nums">
                  · {trackLength.toFixed(3)} km
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TempChip icon={<Snowflake className="h-3 w-3" />} label="AIR" value={airTemp} unit="°C" />
            <TempChip icon={<Flame className="h-3 w-3" />} label="TRACK" value={trackTemp} unit="°C" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Race Laps"
            value={raceLapCount}
            sub="Scheduled race distance"
            accent="red"
            icon={<Timer className="h-4 w-4" />}
          />
          <StatCard
            label="Avg Lap Time"
            value={avgLapMs != null ? fmtLapTimeMs(avgLapMs) : '—'}
            sub="Across all valid laps"
            accent="amber"
            icon={<Gauge className="h-4 w-4" />}
          />
          <StatCard
            label="Projected Race Time"
            value={projectedRaceMs != null ? fmtDurationMs(projectedRaceMs) : '—'}
            sub={`${raceLapCount} × avg lap`}
            accent="emerald"
            icon={<Calculator className="h-4 w-4" />}
          />
          <StatCard
            label="Fuel Budget"
            value={FUEL_BUDGET_KG}
            unit="kg"
            sub="FIA regulation cap"
            accent="default"
            icon={<Fuel className="h-4 w-4" />}
          />
        </div>

        {/* Compound usage summary */}
        <div className="mt-3 flex items-center gap-3 flex-wrap text-[11px] font-mono-nums">
          <span className="text-muted-foreground uppercase tracking-wider">Compound usage in session:</span>
          {(['soft', 'medium', 'hard'] as Compound[]).map((c) => {
            const count = compoundUsage.tally[c] ?? 0
            const pct = compoundUsage.total > 0 ? Math.round((count / compoundUsage.total) * 100) : 0
            return (
              <span key={c} className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5', COMPOUND_BG[c])}>
                <span className="font-bold uppercase">{c}</span>
                <span className="opacity-70">{count} laps · {pct}%</span>
              </span>
            )
          })}
          {compoundUsage.total === 0 && (
            <span className="text-muted-foreground">no tire data yet</span>
          )}
        </div>
      </div>
    </Card>
  )
}

function TempChip({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: number | null; unit: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[10px] text-muted-foreground font-mono-nums">{label}</span>
      <span className={cn('font-mono-nums text-xs font-bold', value == null ? 'text-muted-foreground' : 'text-foreground')}>
        {value == null ? '—' : value.toFixed(1)}{value != null && <span className="text-muted-foreground text-[10px] ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

// ============================================================
// Section 2: Tire-age projection chart
// ============================================================

function TireAgeProjectionCard({ raceLapCount, currentLap }: { raceLapCount: number; currentLap: number }) {
  // Build chart data: lap 1..raceLapCount, deg for each compound.
  const data = useMemo(() => {
    const rows: { lap: number; soft: number; medium: number; hard: number }[] = []
    for (let lap = 1; lap <= raceLapCount; lap++) {
      rows.push({
        lap,
        soft: Math.round(degSoft(lap)),
        medium: Math.round(degMedium(lap)),
        hard: Math.round(degHard(lap)),
      })
    }
    return rows
  }, [raceLapCount])

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur card-hover">
      <SectionHeader
        title="Tire-Age Projection"
        subtitle="Lap-time delta (ms) vs a fresh tire · compound deg models · cliff markers"
        right={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono-nums text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              NOW · LAP {currentLap}
            </Badge>
          </div>
        }
      />
      <div className="px-2 pb-2">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="lap"
                tick={{ fontSize: 10, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'TIRE AGE (LAPS)', position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: '#71717a' } }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                unit="ms"
                width={48}
              />
              <RTooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                labelFormatter={(v) => `Lap ${v}`}
                formatter={(v: any, name: string) => [`${v} ms`, name.charAt(0).toUpperCase() + name.slice(1)]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
                iconType="plainline"
              />
              {/* Cliff reference lines */}
              <ReferenceLine x={CLIFF_LAP.soft} stroke="#f87171" strokeDasharray="4 3" strokeOpacity={0.7}
                label={{ value: 'S cliff', position: 'top', fill: '#f87171', fontSize: 9, offset: 4 }} />
              <ReferenceLine x={CLIFF_LAP.medium} stroke="#fbbf24" strokeDasharray="4 3" strokeOpacity={0.7}
                label={{ value: 'M cliff', position: 'top', fill: '#fbbf24', fontSize: 9, offset: 4 }} />
              <ReferenceLine x={CLIFF_LAP.hard} stroke="#a1a1aa" strokeDasharray="4 3" strokeOpacity={0.7}
                label={{ value: 'H cliff', position: 'top', fill: '#a1a1aa', fontSize: 9, offset: 4 }} />
              {/* Current lap */}
              <ReferenceLine x={currentLap} stroke="#34d399" strokeWidth={1.5}
                label={{ value: 'NOW', position: 'top', fill: '#34d399', fontSize: 10, fontWeight: 700 }} />
              <Line type="monotone" dataKey="soft" name="soft" stroke={COMPOUND_COLOR.soft} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="medium" name="medium" stroke={COMPOUND_COLOR.medium} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="hard" name="hard" stroke={COMPOUND_COLOR.hard} strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="px-4 pb-3 text-[10px] text-muted-foreground font-mono-nums flex items-center gap-4 flex-wrap">
        <span>SOFT: deg = {BASE_OFFSET_MS} + 0.8·age^1.4</span>
        <span>MEDIUM: deg = {BASE_OFFSET_MS} + 0.45·age^1.15</span>
        <span>HARD: deg = {BASE_OFFSET_MS} + 0.28·age^1.05</span>
      </div>
    </Card>
  )
}

// ============================================================
// Section 3: Pit-stop window planner
// ============================================================

function PitWindowPlannerCard({ raceLapCount }: { raceLapCount: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(STRATEGIES[1].id) // default to the fastest

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur card-hover">
      <SectionHeader
        title="Pit-Stop Window Planner"
        subtitle="Optimal pit windows per compound · recommended race strategies"
        right={<Badge variant="outline" className="font-mono-nums text-[10px]">{raceLapCount}-lap race</Badge>}
      />
      <div className="px-4 pb-4 space-y-4">
        {/* Gantt-like pit-window bands */}
        <PitWindowGantt raceLapCount={raceLapCount} />

        {/* Strategies table */}
        <div className="rounded-md border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Strategy</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Stops</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Compounds</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Δ Optimum</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">Risk</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STRATEGIES.map((s) => {
                const isSel = selectedId === s.id
                return (
                  <TableRow
                    key={s.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isSel ? 'bg-red-500/10' : 'hover:bg-red-500/5',
                    )}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {isSel ? (
                          <CircleCheck className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        ) : (
                          <Disc className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground line-clamp-1 hidden sm:block">{s.note}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 font-mono-nums text-xs">
                      {s.stops.map((l, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-muted-foreground mx-0.5">·</span>}
                          <span className="text-amber-300">L{l}</span>
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="py-2.5 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        {s.compounds.map((c, i) => (
                          <span key={i} className={cn('inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold uppercase border', COMPOUND_BG[c])}>
                            {c[0]}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-mono-nums text-xs">
                      <span className={cn(s.projectedDelta < 10 ? 'text-emerald-300' : 'text-amber-300')}>
                        +{s.projectedDelta.toFixed(1)}s
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-center">
                      <RiskBadge risk={s.risk} />
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Button
                        size="sm"
                        variant={isSel ? 'default' : 'outline'}
                        className="h-7 text-[11px]"
                        onClick={(e) => { e.stopPropagation(); setSelectedId(s.id) }}
                      >
                        {isSel ? 'Selected' : 'Select'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  )
}

function PitWindowGantt({ raceLapCount }: { raceLapCount: number }) {
  // Render a horizontal timeline of lap 1..raceLapCount, with colored bands
  // for each compound's optimal pit window.
  const ticks = buildTicks(raceLapCount)
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <TrendingDown className="h-3 w-3" /> Optimal pit windows by compound
      </div>
      <div className="space-y-2">
        {(['soft', 'medium', 'hard'] as Compound[]).map((c) => {
          const w = PIT_WINDOWS.find((p) => p.compound === c)!
          return (
            <div key={c} className="relative">
              <div className="flex items-center gap-2">
                <div className="w-14 shrink-0 text-[10px] font-mono-nums uppercase font-bold" style={{ color: COMPOUND_COLOR[c] }}>
                  {c}
                </div>
                <div className="relative flex-1 h-6 rounded bg-zinc-900/60 border border-border/40 overflow-hidden">
                  {/* Window band */}
                  <div
                    className="absolute top-0 bottom-0 rounded-sm"
                    style={{
                      left: `${((w.start - 1) / Math.max(1, raceLapCount)) * 100}%`,
                      width: `${((w.end - w.start + 1) / Math.max(1, raceLapCount)) * 100}%`,
                      backgroundColor: COMPOUND_COLOR[c],
                      opacity: 0.45,
                      borderLeft: `2px solid ${COMPOUND_COLOR[c]}`,
                      borderRight: `2px solid ${COMPOUND_COLOR[c]}`,
                    }}
                  />
                  {/* Tick marks */}
                  {ticks.map((t) => (
                    <div key={t} className="absolute top-0 bottom-0 w-px bg-zinc-700/60" style={{ left: `${((t - 1) / Math.max(1, raceLapCount)) * 100}%` }} />
                  ))}
                  {/* Window label */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 text-[9px] font-mono-nums font-bold text-foreground whitespace-nowrap"
                    style={{
                      left: `calc(${((w.start - 1) / Math.max(1, raceLapCount)) * 100}% + 4px)`,
                    }}
                  >
                    L{w.start}–{w.end}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {/* Lap number axis */}
        <div className="flex items-center gap-2 pt-0.5">
          <div className="w-14 shrink-0" />
          <div className="relative flex-1 h-4">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 text-[9px] font-mono-nums text-muted-foreground -translate-x-1/2"
                style={{ left: `${((t - 1) / Math.max(1, raceLapCount)) * 100}%` }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function buildTicks(raceLapCount: number): number[] {
  // Pick ~6-8 tick marks evenly across the race.
  const target = 7
  const step = Math.max(1, Math.round(raceLapCount / target))
  const ticks: number[] = []
  for (let l = 1; l <= raceLapCount; l += step) ticks.push(l)
  if (ticks[ticks.length - 1] !== raceLapCount) ticks.push(raceLapCount)
  return ticks
}

function RiskBadge({ risk }: { risk: 'LOW' | 'MED' | 'HIGH' }) {
  const map = {
    LOW: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    MED: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    HIGH: 'border-red-500/40 bg-red-500/10 text-red-300',
  }
  return (
    <Badge variant="outline" className={cn('font-mono-nums text-[10px] font-bold', map[risk])}>
      {risk}
    </Badge>
  )
}

// ============================================================
// Section 4: Undercut simulator
// ============================================================

function UndercutSimulatorCard({ raceLapCount, currentLap }: { raceLapCount: number; currentLap: number }) {
  const [pitLap, setPitLap] = useState<number>(Math.min(currentLap + 1, raceLapCount))
  const [pace, setPace] = useState<'slow' | 'normal' | 'push'>('push')

  // undercut_gain = (pit_lap_difference * 1.5s) - out_lap_penalty - tire_warmup_loss
  const result = useMemo(() => {
    const outLapPenalty = PACE_PENALTY[pace]
    const undercutGain = RIVAL_PIT_DELTA_LAPS * 1.5 - outLapPenalty - TIRE_WARMUP_LOSS
    return {
      gain: undercutGain,
      breakdown: {
        undercutBase: RIVAL_PIT_DELTA_LAPS * 1.5,
        outLapPenalty,
        warmupLoss: TIRE_WARMUP_LOSS,
      },
    }
  }, [pace])

  const positive = result.gain > 0

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur card-hover">
      <SectionHeader
        title="Undercut Simulator"
        subtitle={`Pit before the rival (rival stops +${RIVAL_PIT_DELTA_LAPS} laps later) — net gain model`}
        right={<Badge variant="outline" className="font-mono-nums text-[10px]"><Calculator className="h-3 w-3 mr-1" />interactive</Badge>}
      />
      <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Pit lap</label>
              <Badge variant="outline" className="font-mono-nums text-xs border-red-500/40 bg-red-500/10 text-red-300">
                LAP {pitLap}
              </Badge>
            </div>
            <Slider
              value={[pitLap]}
              min={1}
              max={raceLapCount}
              step={1}
              onValueChange={(v) => setPitLap(v[0])}
              aria-label="Pit lap"
            />
            <div className="flex items-center justify-between mt-1.5 text-[9px] font-mono-nums text-muted-foreground">
              <span>L1</span>
              <span>now: L{currentLap}</span>
              <span>L{raceLapCount}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Out-lap pace</label>
            <RadioGroup
              value={pace}
              onValueChange={(v) => setPace(v as 'slow' | 'normal' | 'push')}
              className="grid grid-cols-3 gap-2"
            >
              <PaceOption value="slow" label="Slow" desc="+2.0s penalty" />
              <PaceOption value="normal" label="Normal" desc="+1.0s penalty" />
              <PaceOption value="push" label="Push" desc="+0.3s penalty" />
            </RadioGroup>
          </div>

          {/* Breakdown */}
          <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-1.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Calculation breakdown</div>
            <CalcRow label={`Undercut base (${RIVAL_PIT_DELTA_LAPS} laps × 1.5s)`} value={`+${result.breakdown.undercutBase.toFixed(1)}s`} color="text-emerald-300" />
            <CalcRow label={`Out-lap penalty (${pace})`} value={`−${result.breakdown.outLapPenalty.toFixed(1)}s`} color="text-red-300" />
            <CalcRow label="Tire warm-up loss" value={`−${result.breakdown.warmupLoss.toFixed(1)}s`} color="text-red-300" />
            <div className="h-px bg-border/60 my-1" />
            <CalcRow label="Net gain vs rival" value={`${positive ? '+' : ''}${result.gain.toFixed(2)}s`} color={positive ? 'text-emerald-300' : 'text-red-300'} bold />
          </div>
        </div>

        {/* Result */}
        <div className={cn(
          'relative rounded-lg border p-4 flex flex-col items-center justify-center text-center overflow-hidden min-h-[200px]',
          positive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5',
        )}>
          <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-center gap-1.5">
              {positive ? <CircleCheck className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
              Undercut verdict · L{pitLap}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${positive ? 'pos' : 'neg'}-${result.gain.toFixed(2)}`}
                initial={{ opacity: 0, scale: 0.85, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex items-baseline justify-center gap-1"
              >
                <span className={cn(
                  'font-mono-nums font-black leading-none',
                  positive ? 'text-emerald-400 text-5xl' : 'text-red-400 text-5xl',
                )}>
                  {positive ? '+' : ''}{result.gain.toFixed(2)}
                </span>
                <span className="text-xl text-muted-foreground font-mono-nums">s</span>
              </motion.div>
            </AnimatePresence>
            <div className={cn(
              'mt-3 text-sm font-bold uppercase tracking-wider',
              positive ? 'text-emerald-300' : 'text-red-300',
            )}>
              {positive ? 'UNDERCUT WORKS' : 'UNDERCUT FAILS'}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground max-w-[240px]">
              {positive
                ? `Pitting L${pitLap} (${pace}) gains ${result.gain.toFixed(2)}s before the rival stops at L${pitLap + RIVAL_PIT_DELTA_LAPS}.`
                : `Pitting L${pitLap} (${pace}) loses ${Math.abs(result.gain).toFixed(2)}s — rival stays out & matches pace.`}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono-nums text-muted-foreground">
              <Trophy className="h-3 w-3" />
              {positive ? 'recommend: BOX THIS LAP' : 'recommend: HOLD POSITION'}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function PaceOption({ value, label, desc }: { value: 'slow' | 'normal' | 'push'; label: string; desc: string }) {
  return (
    <label
      htmlFor={`pace-${value}`}
      className="cursor-pointer rounded-md border border-border/50 bg-background/40 p-2.5 hover:border-border hover:bg-accent transition-colors has-[:checked]:border-red-500/50 has-[:checked]:bg-red-500/10"
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem id={`pace-${value}`} value={value} />
        <div className="min-w-0">
          <div className="text-xs font-bold">{label}</div>
          <div className="text-[10px] text-muted-foreground font-mono-nums">{desc}</div>
        </div>
      </div>
    </label>
  )
}

function CalcRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className={cn('text-muted-foreground', bold && 'text-foreground font-bold')}>{label}</span>
      <span className={cn('font-mono-nums', color, bold && 'font-bold text-sm')}>{value}</span>
    </div>
  )
}

// ============================================================
// Section 5: Live tire temps strip
// ============================================================

function LiveTireTempsCard({ socket }: { socket: ReturnType<typeof useTelemetrySocket> }) {
  const ourDrivers = socket.drivers.filter((d) => !d.isRival).slice(0, 2)
  // Fallback to TSU/LAW if no drivers loaded yet.
  const drivers = ourDrivers.length > 0 ? ourDrivers : [
    { code: 'TSU', name: 'Yuki Tsunoda', team: 'Apex Racing', number: 22, isRival: false } as any,
    { code: 'LAW', name: 'Liam Lawson', team: 'Apex Racing', number: 30, isRival: false } as any,
  ]

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur card-hover">
      <SectionHeader
        title="Live Tire Temperatures"
        subtitle="Per-corner carcass temps (°C) from the live tick stream · our 2 cars"
        right={
          <Badge variant="outline" className={cn(
            'font-mono-nums text-[10px]',
            socket.connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5', socket.connected ? 'bg-emerald-400 blink' : 'bg-red-500')} />
            {socket.connected ? 'STREAM LIVE' : 'OFFLINE'}
          </Badge>
        }
      />
      <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {drivers.map((d) => (
          <DriverTireCard key={d.code} code={d.code} name={d.name} tick={socket.ticks[d.code]} />
        ))}
      </div>
    </Card>
  )
}

function DriverTireCard({ code, name, tick }: { code: string; name: string; tick: any }) {
  const ch = tick?.channels ?? {}
  const fl = ch.tire_fl_temp ?? null
  const fr = ch.tire_fr_temp ?? null
  const rl = ch.tire_rl_temp ?? null
  const rr = ch.tire_rr_temp ?? null
  const lap = tick?.lap ?? null
  const sector = tick?.sector ?? null
  const tires: { key: string; label: string; temp: number | null }[] = [
    { key: 'fl', label: 'FL', temp: fl },
    { key: 'fr', label: 'FR', temp: fr },
    { key: 'rl', label: 'RL', temp: rl },
    { key: 'rr', label: 'RR', temp: rr },
  ]

  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono-nums font-bold text-red-300 text-sm">{code}</span>
          <span className="text-xs text-muted-foreground truncate">{name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {lap != null && <Badge variant="outline" className="font-mono-nums text-[10px]">L{lap}</Badge>}
          {sector != null && (
            <Badge variant="outline" className="font-mono-nums text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-300">
              S{sector}
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {tires.map((t) => (
          <TireTempBar key={t.key} label={t.label} temp={t.temp} />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[9px] font-mono-nums text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-emerald-500" />80–100</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-amber-500" />100–115</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-red-500" />out of range</span>
      </div>
    </div>
  )
}

function TireTempBar({ label, temp }: { label: string; temp: number | null }) {
  const range = { min: 60, max: 130 }
  const pct = temp == null ? 0 : Math.max(2, Math.min(100, ((temp - range.min) / (range.max - range.min)) * 100))
  const color = tireTempColor(temp)
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-[10px] font-mono-nums font-bold text-muted-foreground">{label}</span>
      <div className="relative flex-1 h-4 rounded bg-zinc-900/70 border border-border/40 overflow-hidden">
        {/* Optimal range band 80-100 */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/10 border-x border-emerald-500/20"
          style={{
            left: `${((80 - range.min) / (range.max - range.min)) * 100}%`,
            width: `${((100 - 80) / (range.max - range.min)) * 100}%`,
          }}
        />
        {temp != null && (
          <div
            className={cn('h-full transition-all duration-300', color)}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <span className={cn(
        'w-12 text-right font-mono-nums text-xs font-bold',
        temp == null ? 'text-muted-foreground' : color.replace('bg-', 'text-'),
      )}>
        {temp == null ? '—' : `${temp.toFixed(0)}°`}
      </span>
    </div>
  )
}

function tireTempColor(temp: number | null): string {
  if (temp == null) return 'bg-zinc-600'
  if (temp < 80) return 'bg-red-500'
  if (temp <= 100) return 'bg-emerald-500'
  if (temp <= 115) return 'bg-amber-500'
  return 'bg-red-500'
}

// ============================================================
// Formatters
// ============================================================

function fmtLapTimeMs(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function fmtDurationMs(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}:${String(s).padStart(2, '0')}`
}
