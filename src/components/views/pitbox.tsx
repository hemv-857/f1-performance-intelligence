'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket'
import { useAppStore } from '@/lib/store'
import {
  Radio,
  AlertTriangle,
  Zap,
  GitBranch,
  RefreshCw,
  Play,
  CircleCheck,
  Clock,
  Gauge,
  Fuel,
  Activity,
  ShieldCheck,
} from 'lucide-react'

interface AlertItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  source: string
  title: string
  message: string
  status: string
  autoAction: string | null
  driver: { code: string; name: string } | null
  createdAt: string
  resolvedAt: string | null
}

const PLAYBOOKS = [
  {
    id: 'kill-duplicate-workers',
    name: 'Kill duplicate workers',
    icon: Zap,
    color: 'amber',
    toast: 'Killing duplicate Spark workers…',
  },
  {
    id: 'failover-secondary',
    name: 'Failover to secondary',
    icon: GitBranch,
    color: 'red',
    toast: 'Failing over to secondary buffer…',
  },
  {
    id: 'rollback-deploy',
    name: 'Rollback failed deploy',
    icon: RefreshCw,
    color: 'emerald',
    toast: 'Rolling back failed deployment…',
  },
] as const

function tireLetter(compound: string): string {
  return compound?.toUpperCase()?.[0] ?? '?'
}

const tireColorClass: Record<string, string> = {
  S: 'border-red-500/50 bg-red-500/15 text-red-300',
  M: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
  H: 'border-zinc-400/40 bg-zinc-400/15 text-zinc-200',
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 60
  const h = 22
  if (data.length < 2) {
    return (
      <div className="h-6 w-[60px] shrink-0 flex items-center justify-end text-[9px] font-mono-nums text-muted-foreground/40">
        —
      </div>
    )
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PitBoxView({ socket }: { socket: ReturnType<typeof useTelemetrySocket> }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [speedHist, setSpeedHist] = useState<Record<string, number[]>>({})
  const [lastTicks, setLastTicks] = useState<typeof socket.ticks>(socket.ticks)
  const { sessions, selectedSessionId } = useAppStore()

  const alertsQ = useQuery({
    queryKey: ['pitbox-alerts'],
    refetchInterval: 15000,
    queryFn: async () => {
      const r = await fetch('/api/devops/alerts')
      const j = await r.json()
      return (j.alerts ?? []) as AlertItem[]
    },
  })

  // Maintain a per-driver ring buffer of recent speeds for the inline sparkline.
  // Uses React's "adjust state during render" pattern (see React docs) — runs
  // only when socket.ticks has actually changed, and bails out if no new speed.
  if (socket.ticks !== lastTicks) {
    setLastTicks(socket.ticks)
    setSpeedHist((prev) => {
      let next = prev
      for (const code in socket.ticks) {
        const speed = socket.ticks[code]?.channels.speed
        if (speed != null) {
          const arr = next[code] ?? []
          const last = arr[arr.length - 1]
          if (last !== speed) {
            if (next === prev) next = { ...prev }
            next[code] = [...arr, speed].slice(-12)
          }
        }
      }
      return next
    })
  }

  const p = socket.pipeline
  const healthy = p?.primaryHealthy ?? true
  const lag = (p?.consumerLagMs ?? 400) / 1000
  const lagColor = lag > 5 ? 'text-red-400' : lag > 1 ? 'text-amber-400' : 'text-emerald-400'

  // Sort drivers by live race progress (lap + lapProgress)
  const sortedDrivers = [...socket.drivers].sort((a, b) => {
    const ta = socket.ticks[a.code]
    const tb = socket.ticks[b.code]
    const progA = a.lap + (ta?.lapProgress ?? 0)
    const progB = b.lap + (tb?.lapProgress ?? 0)
    return progB - progA
  })

  const filteredAlerts = (alertsQ.data ?? []).filter(
    (a) => a.severity === 'critical' || a.severity === 'warning',
  )

  // Live session info for the bottom race info bar
  const liveSession = sessions.find((s) => s.status === 'live')
  const selSession = sessions.find((s) => s.id === selectedSessionId)
  const session = liveSession ?? selSession
  const roundLabel = session ? `R${session.round}` : 'R2'
  const circuitLabel = session?.circuit?.country?.toUpperCase() ?? 'SINGAPORE'
  const typeLabel = session?.type ?? 'Q'

  const runPlaybook = (pb: (typeof PLAYBOOKS)[number]) => {
    socket.runPlaybook(pb.id)
    toast.info(pb.toast)
  }

  const runSynthetic = () => {
    socket.runSyntheticRace()
    toast.info('Synthetic race sim started', {
      description: 'Stress-testing all telemetry pipelines for 3s',
    })
  }

  const refresh = () => {
    alertsQ.refetch()
    toast.success('Pipeline status refreshed')
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      {/* ===== 1. Live Pipeline Status bar ===== */}
      <Card
        className={cn(
          'border bg-card/60 p-4 backdrop-blur',
          healthy ? 'border-border/50' : 'border-red-500/40',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  healthy ? 'bg-emerald-400' : 'bg-red-500 pulse-red',
                )}
              />
              <span
                className={cn(
                  'font-mono-nums text-base font-bold tracking-tight',
                  healthy ? 'text-emerald-300' : 'text-red-300',
                )}
              >
                PIPELINE {healthy ? 'NOMINAL' : 'FAILOVER'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn('font-mono-nums text-4xl font-bold leading-none', lagColor)}>
                {lag.toFixed(2)}
                <span className="ml-1 text-lg">s</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">LAG</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-mono-nums font-semibold',
                  p?.dataLossGuarantee
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-300',
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                Zero data loss ✓
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/40 px-2 py-1 text-[10px] font-mono-nums text-muted-foreground">
                <Radio className="h-3 w-3 text-amber-400" />
                {(p?.ingestRateHz ?? 1000).toLocaleString()}Hz
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/40 px-2 py-1 text-[10px] font-mono-nums text-muted-foreground">
                <Activity className="h-3 w-3 text-emerald-400" />
                {p?.sparkJobsRunning ?? 3} spark jobs
              </span>
            </div>
          </div>
          <button
            onClick={refresh}
            aria-label="Refresh pipeline status"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-95"
          >
            <RefreshCw className="h-6 w-6" />
          </button>
        </div>
      </Card>

      {/* ===== 2. Live Timing Leaderboard ===== */}
      <Card className="border-border/50 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">Live Timing</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'font-mono-nums text-[10px]',
                socket.connected
                  ? 'border-emerald-500/40 text-emerald-300'
                  : 'border-red-500/40 text-red-300',
              )}
            >
              {socket.connected ? 'LIVE 10Hz' : 'CONNECTING'}
            </Badge>
            <Badge variant="outline" className="font-mono-nums text-[10px]">
              {socket.drivers.length} drivers
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          {sortedDrivers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
              <RefreshCw className="mb-2 h-6 w-6 animate-spin text-muted-foreground" />
              Waiting for drivers…
            </div>
          )}

          {sortedDrivers.map((d, i) => {
            const tick = socket.ticks[d.code]
            const speed = tick?.channels.speed ?? 0
            const throttle = tick?.channels.throttle ?? 0
            const brake = tick?.channels.brake ?? 0
            const fl = tick?.channels.tire_fl_temp ?? 0
            const fr = tick?.channels.tire_fr_temp ?? 0
            const rl = tick?.channels.tire_rl_temp ?? 0
            const rr = tick?.channels.tire_rr_temp ?? 0
            const hist = speedHist[d.code] ?? []
            const isOpen = expanded === d.code
            const tLetter = tireLetter(d.tireCompound)
            const sector = tick?.sector ?? d.sector
            const sparkColor = d.isRival ? '#fbbf24' : '#f87171'
            const posColor = d.isRival
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-red-500/20 text-red-300 border-red-500/50'

            return (
              <div
                key={d.code}
                className={cn(
                  'overflow-hidden rounded-lg border bg-background/40 transition',
                  isOpen ? 'border-border/70' : 'border-border/40',
                )}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : d.code)}
                  aria-expanded={isOpen}
                  className="flex min-h-[64px] w-full items-center gap-3 p-3 text-left transition hover:bg-accent/30"
                >
                  {/* Position circle */}
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono-nums text-sm font-bold',
                      posColor,
                    )}
                  >
                    P{i + 1}
                  </div>

                  {/* Driver code + lap */}
                  <div className="min-w-[68px] shrink-0">
                    <div className="font-mono-nums text-2xl font-bold leading-none">{d.code}</div>
                    <div className="mt-1 font-mono-nums text-[10px] text-muted-foreground">
                      L{d.lap}
                    </div>
                  </div>

                  {/* Right side: sparkline + speed + sectors + tire */}
                  <div className="ml-auto flex items-center gap-2.5">
                    <Sparkline data={hist} color={sparkColor} />

                    <div className="shrink-0 text-right">
                      <div className="font-mono-nums text-2xl font-bold leading-none">
                        {Math.round(speed)}
                        <span className="ml-1 text-[10px] text-muted-foreground">km/h</span>
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        {[1, 2, 3].map((s) => (
                          <span
                            key={s}
                            className={cn(
                              'inline-flex h-5 w-5 items-center justify-center rounded font-mono-nums text-[9px] font-bold',
                              s === sector
                                ? d.isRival
                                  ? 'bg-amber-500/30 text-amber-300'
                                  : 'bg-red-500/30 text-red-300'
                                : 'bg-zinc-700/40 text-zinc-500',
                            )}
                          >
                            S{s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Tire compound letter */}
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border font-mono-nums text-base font-bold',
                        tireColorClass[tLetter] ?? tireColorClass.H,
                      )}
                    >
                      {tLetter}
                    </div>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-2 border-t border-border/40 p-3">
                        <ExpandMetric
                          label="FL"
                          value={Math.round(fl)}
                          unit="°C"
                          icon={<Gauge className="h-3 w-3" />}
                          accent="red"
                        />
                        <ExpandMetric
                          label="FR"
                          value={Math.round(fr)}
                          unit="°C"
                          icon={<Gauge className="h-3 w-3" />}
                          accent="red"
                        />
                        <ExpandMetric
                          label="RL"
                          value={Math.round(rl)}
                          unit="°C"
                          icon={<Gauge className="h-3 w-3" />}
                          accent="amber"
                        />
                        <ExpandMetric
                          label="RR"
                          value={Math.round(rr)}
                          unit="°C"
                          icon={<Gauge className="h-3 w-3" />}
                          accent="amber"
                        />
                        <ExpandMetric
                          label="THR"
                          value={Math.round(throttle)}
                          unit="%"
                          icon={<Activity className="h-3 w-3" />}
                          accent="emerald"
                        />
                        <ExpandMetric
                          label="BRK"
                          value={Math.round(brake)}
                          unit="%"
                          icon={<AlertTriangle className="h-3 w-3" />}
                          accent="red"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ===== 3. Critical Alerts strip ===== */}
      <Card className="border-border/50 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={cn('h-4 w-4', filteredAlerts.length > 0 ? 'text-amber-400' : 'text-emerald-400')}
            />
            <span className="text-xs font-semibold uppercase tracking-wider">Critical Alerts</span>
          </div>
          <Badge variant="outline" className="font-mono-nums text-[10px]">
            {filteredAlerts.length} active
          </Badge>
        </div>

        {alertsQ.isLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Loading alerts…
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-emerald-300 text-xs">
            <CircleCheck className="h-4 w-4 shrink-0" />
            All systems clear — no critical alerts.
          </div>
        ) : (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
            {filteredAlerts.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'flex min-h-[80px] w-[200px] shrink-0 flex-col justify-between rounded-lg border p-3',
                  a.severity === 'critical'
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-amber-500/50 bg-amber-500/10',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        a.severity === 'critical' ? 'text-red-400' : 'text-amber-400',
                      )}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-wider',
                        a.severity === 'critical' ? 'text-red-300' : 'text-amber-300',
                      )}
                    >
                      {a.severity}
                    </span>
                    {a.driver && (
                      <span className="ml-auto font-mono-nums text-[10px] font-bold text-muted-foreground">
                        {a.driver.code}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs font-medium leading-tight">{a.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                    {a.message}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 font-mono-nums text-[9px] text-muted-foreground">
                  <span className="truncate">{a.source}</span>
                  <span className="ml-auto shrink-0">
                    {new Date(a.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ===== 4. Quick Playbook actions ===== */}
      <Card className="border-border/50 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider">Quick Playbooks</span>
        </div>
        <div className="space-y-2">
          {PLAYBOOKS.map((pb) => {
            const Icon = pb.icon
            const colorMap: Record<string, string> = {
              amber: 'border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300',
              red: 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-300',
              emerald:
                'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300',
            }
            const iconColor: Record<string, string> = {
              amber: 'text-amber-400',
              red: 'text-red-400',
              emerald: 'text-emerald-400',
            }
            return (
              <button
                key={pb.id}
                onClick={() => runPlaybook(pb)}
                className={cn(
                  'flex min-h-[64px] w-full items-center gap-3 rounded-lg border px-4 transition active:scale-[0.98]',
                  colorMap[pb.color],
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', iconColor[pb.color])} />
                <span className="flex-1 text-left text-sm font-medium">{pb.name}</span>
                <Play className={cn('h-4 w-4 shrink-0', iconColor[pb.color])} />
              </button>
            )
          })}
        </div>
      </Card>

      {/* ===== 5. Race info + synthetic race sim ===== */}
      <Card className="border-border/50 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-amber-400" />
            <span className="font-mono-nums text-xs uppercase tracking-wider text-muted-foreground">
              {roundLabel} · {circuitLabel} · {typeLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono-nums text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {(p?.ingestRateHz ?? 1000).toLocaleString()}Hz
          </div>
        </div>
        <button
          onClick={runSynthetic}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg border-2 border-amber-500/50 bg-amber-500/5 text-sm font-medium text-amber-300 transition hover:bg-amber-500/10 active:scale-[0.98]"
        >
          <Play className="h-4 w-4" />
          Run synthetic race simulation
        </button>
      </Card>

      {/* ===== Playbook result banner (dismissible) ===== */}
      <AnimatePresence>
        {socket.playbookResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <CircleCheck className="h-4 w-4 shrink-0" />
                  Playbook completed in {(socket.playbookResult.durationMs / 1000).toFixed(1)}s
                </div>
                <button
                  onClick={() => socket.clearPlaybookResult()}
                  aria-label="Dismiss"
                  className="text-xs text-muted-foreground transition hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <ol className="mt-2 space-y-0.5 font-mono-nums text-[10px]">
                {socket.playbookResult.steps.map((s: string, i: number) => (
                  <li key={i} className="text-emerald-200/80">
                    ✓ {s}
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ExpandMetric({
  label,
  value,
  unit,
  icon,
  accent,
}: {
  label: string
  value: number
  unit: string
  icon: React.ReactNode
  accent: 'red' | 'amber' | 'emerald'
}) {
  const accentClass: Record<string, string> = {
    red: 'text-red-300',
    amber: 'text-amber-300',
    emerald: 'text-emerald-300',
  }
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('mt-1 font-mono-nums text-xl font-bold leading-none', accentClass[accent])}>
        {value}
        <span className="ml-0.5 text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}
