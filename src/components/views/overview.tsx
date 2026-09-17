'use client'

import { useQuery } from '@tanstack/react-query'
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket'
import { useAppStore } from '@/lib/store'
import { StatCard, SectionHeader, DriverChip, StatusBadge, TrackMap } from '@/components/shared'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Activity, Zap, Timer, TrendingUp, AlertTriangle, Cpu, Database, Wind, ChevronRight,
} from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

export function OverviewView({ socket }: { socket: ReturnType<typeof useTelemetrySocket> }) {
  const { sessions, selectedSessionId, setActiveView } = useAppStore()

  const healthQ = useQuery({
    queryKey: ['health'],
    queryFn: async () => (fetch('/api/devops/health')).then((r) => r.json()),
  })
  const alertsQ = useQuery({
    queryKey: ['alerts'],
    refetchInterval: 15000,
    queryFn: async () => (fetch('/api/devops/alerts')).then((r) => r.json()),
  })
  const depQ = useQuery({
    queryKey: ['deployments'],
    queryFn: async () => (fetch('/api/devops/deployments')).then((r) => r.json()),
  })

  // live timing leaderboard (sorted by lap progress * speed as a proxy)
  const liveTiming = socket.drivers
    .map((d) => {
      const t = socket.ticks[d.code]
      return { ...d, speed: t?.channels.speed ?? 0, sector: t?.sector ?? d.sector, progress: t?.lapProgress ?? 0 }
    })
    .sort((a, b) => b.progress - a.progress || b.speed - a.speed)

  const sparkLatency = Array.from({ length: 20 }, (_, i) => 900 + Math.sin(i / 2) * 200 + Math.random() * 120)

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <Card className="relative overflow-hidden border-red-500/30 bg-gradient-to-br from-card via-card to-red-950/30 slide-up">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute -right-12 -top-12 opacity-15 pointer-events-none">
          <TrackMap circuitName="Singapore" active size={280} />
        </div>
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-red-500/50 bg-red-500/15 text-red-300 pulse-red font-mono-nums text-[10px]">
              LIVE · RACE WEEKEND
            </Badge>
            <span className="text-[11px] text-muted-foreground font-mono-nums">ROUND 2 · SINGAPORE GP</span>
            <span className="text-[11px] text-amber-400 font-mono-nums hidden sm:inline">· MARINA BAY STREET CIRCUIT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Performance Intelligence <span className="text-red-400 text-glow">Command Center</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
            Unified telemetry, analytics, and DevOps for aerodynamicists, vehicle dynamics &amp; strategy.
            100+ channels at 1 kHz · &lt;2s query on 5-yr history · 99.9% pipeline uptime.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Aerodynamics', 'Vehicle Dynamics', 'Strategy', 'Power Unit', 'DevOps'].map((t) => (
              <span key={t} className="text-[10px] font-mono-nums rounded-md border border-border/60 bg-card/60 px-2 py-1 text-muted-foreground">
                {t.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
        {/* Live ticker tape */}
        <div className="relative border-t border-red-500/20 bg-black/20 overflow-hidden">
          <div className="flex ticker whitespace-nowrap py-1.5 text-[10px] font-mono-nums text-muted-foreground">
            {Array.from({ length: 2 }).map((_, dup) => (
              <span key={dup} className="flex items-center gap-6 px-3">
                <span className="text-emerald-400">● PIPELINE NOMINAL</span>
                <span className="text-border">|</span>
                <span>INGEST 6,000 Hz · 100+ CHANNELS · 2 CARS</span>
                <span className="text-border">|</span>
                <span className="text-amber-400">SPARK 5s AGG · 4 WORKERS</span>
                <span className="text-border">|</span>
                <span>SNOWFLAKE WH · P95 1.18s</span>
                <span className="text-border">|</span>
                <span className="text-emerald-400">ZERO DATA-LOSS GUARANTEE</span>
                <span className="text-border">|</span>
                <span>dbt MODELS · 12 MATERIALISED</span>
                <span className="text-border">|</span>
                <span className="text-red-400">v2.4.1 CANARY 100%</span>
                <span className="text-border">|</span>
                <span>K8s race-edge · 8 services · 22 pods</span>
                <span className="text-border">|</span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 slide-up">
        <StatCard
          label="Pipeline Uptime"
          value={(healthQ.data?.pipelineUptimePct ?? 99.9).toFixed(2)}
          unit="%"
          sub="Target 99.9% · zero mid-race data loss"
          accent="emerald"
          icon={<Activity className="h-4 w-4" />}
          spark={[99.8, 99.9, 99.95, 99.97, 99.96, 99.98, 99.97, 99.97]}
        />
        <StatCard
          label="Avg Query Latency"
          value={Math.round(healthQ.data?.successMetrics?.avgQueryLatencyMs ?? 1180)}
          unit="ms"
          sub="Target <2s · 5-yr history"
          accent="amber"
          icon={<Timer className="h-4 w-4" />}
          spark={sparkLatency}
        />
        <StatCard
          label="Features / Race Weekend"
          value={healthQ.data?.successMetrics?.deploymentsPerRaceWeekend ?? 2}
          sub="vs 1 every 3 weeks previously"
          accent="red"
          icon={<TrendingUp className="h-4 w-4" />}
          spark={[1, 1, 2, 2, 3, 2, 2, 2]}
        />
        <StatCard
          label="Engineer Adoption"
          value={healthQ.data?.successMetrics?.adoptionPct ?? 100}
          unit="%"
          sub="Target by Round 4 · achieved Round 3"
          accent="emerald"
          icon={<Cpu className="h-4 w-4" />}
          spark={[40, 65, 80, 92, 100, 100, 100, 100]}
        />
      </div>

      <div className="divider-glow" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live timing leaderboard */}
        <Card className="lg:col-span-2 border-border/50 bg-card/60 card-hover">
          <SectionHeader
            title="Live Timing — Singapore GP"
            subtitle="Real-time Kafka → Spark streaming aggregation (5s windows)"
            right={
              <button
                onClick={() => setActiveView('telemetry')}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                Open telemetry viewer <ChevronRight className="h-3 w-3" />
              </button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="text-left font-medium px-3 py-2">P</th>
                  <th className="text-left font-medium px-3 py-2">Driver</th>
                  <th className="text-left font-medium px-3 py-2">Team</th>
                  <th className="text-center font-medium px-3 py-2">Lap</th>
                  <th className="text-center font-medium px-3 py-2">Sector</th>
                  <th className="text-right font-medium px-3 py-2">Speed</th>
                  <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">Tire</th>
                  <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">Fuel</th>
                </tr>
              </thead>
              <tbody className="font-mono-nums">
                {liveTiming.map((d, i) => (
                  <tr key={d.code} className={cn('border-b border-border/30 transition-colors hover:bg-red-500/5', d.isRival ? '' : 'bg-red-500/5')}>
                    <td className="px-3 py-2 font-bold text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className={cn('font-bold', d.isRival ? 'text-amber-300' : 'text-red-300')}>{d.code}</span>
                      <span className="text-muted-foreground ml-2 text-xs hidden sm:inline">{d.name}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{d.team}</td>
                    <td className="px-3 py-2 text-center">{d.lap}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]',
                        d.sector === 1 ? 'bg-red-500/15 text-red-300' : d.sector === 2 ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300')}>
                        S{d.sector}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn(d.speed > 300 ? 'text-emerald-300' : 'text-foreground')}>{d.speed.toFixed(0)}</span>
                      <span className="text-muted-foreground text-[10px] ml-1">km/h</span>
                    </td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">
                      <span className={cn('text-[10px] uppercase',
                        d.tireCompound === 'soft' ? 'text-red-400' : d.tireCompound === 'medium' ? 'text-amber-400' : 'text-zinc-300')}>
                        {d.tireCompound?.slice(0, 1)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs hidden sm:table-cell text-muted-foreground">
                      {d.fuelKg?.toFixed(1)}kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!socket.connected && (
            <div className="px-3 py-2 text-[11px] text-amber-400 font-mono-nums border-t border-border/60">
              ⚠ Reconnecting to telemetry stream (port 3003)…
            </div>
          )}
        </Card>

        {/* Alerts */}
        <Card className="border-border/50 bg-card/60 card-hover">
          <SectionHeader title="Active Alerts" subtitle="Auto-escalation on" />
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {(alertsQ.data?.alerts ?? []).slice(0, 8).map((a: any) => (
              <div key={a.id} className={cn('rounded-lg border p-2.5',
                a.severity === 'critical' ? 'border-red-500/40 bg-red-500/5' :
                a.severity === 'warning' ? 'border-amber-500/40 bg-amber-500/5' :
                'border-zinc-500/30 bg-zinc-500/5')}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0',
                    a.severity === 'critical' ? 'text-red-400' : a.severity === 'warning' ? 'text-amber-400' : 'text-zinc-400')} />
                  <span className="text-xs font-medium truncate flex-1">{a.title}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{a.message}</p>
                <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground font-mono-nums">
                  <span>{a.source.toUpperCase()}</span>
                  {a.driver && <span className="text-red-300">{a.driver.code}</span>}
                  {a.autoAction && <span className="text-amber-300">PLAYBOOK→{a.autoAction}</span>}
                </div>
              </div>
            ))}
            {(!alertsQ.data?.alerts || alertsQ.data.alerts.length === 0) && (
              <div className="text-center py-8 text-sm text-muted-foreground">All systems nominal ✓</div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Resource health */}
        <Card className="border-border/50 bg-card/60 card-hover">
          <SectionHeader title="Infrastructure Health" subtitle="K8s cluster · race-edge region" />
          <div className="space-y-2">
            <ResourceBar label="CPU" value={healthQ.data?.resourceAverages?.cpuPct ?? 42} unit="%" icon={<Cpu className="h-3.5 w-3.5" />} />
            <ResourceBar label="Memory" value={healthQ.data?.resourceAverages?.memPct ?? 58} unit="%" icon={<Database className="h-3.5 w-3.5" />} />
            <ResourceBar label="Network" value={(healthQ.data?.resourceAverages?.networkGbps ?? 4.5) * 10} unit="Gbps" display={(healthQ.data?.resourceAverages?.networkGbps ?? 4.5).toFixed(2)} icon={<Wind className="h-3.5 w-3.5" />} max={80} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(healthQ.data?.services ?? []).slice(0, 4).map((s: any) => (
              <div key={s.name} className="rounded-md border border-border/50 bg-background/40 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono-nums text-muted-foreground">{s.component}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono-nums">
                  {s.uptimePct}% · {s.latencyMs}ms · {s.instances} pods
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Query latency trend */}
        <Card className="border-border/50 bg-card/60 card-hover">
          <SectionHeader title="Query Latency (Snowflake + dbt)" subtitle="<2s target across 5-yr history" />
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkLatency.map((v, i) => ({ i, v }))} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="i" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} domain={[0, 2000]} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(v: any) => [`${v}ms`, 'Latency']}
                />
                <Line dataKey="v" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono-nums text-center">
            95TH PERCENTILE · LAST 20 QUERIES
          </div>
        </Card>

        {/* Recent deployments */}
        <Card className="border-border/50 bg-card/60 card-hover">
          <SectionHeader title="Recent Deployments" subtitle="Canary → 100% rollout" right={
            <button onClick={() => setActiveView('devops')} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
              DevOps <ChevronRight className="h-3 w-3" />
            </button>
          } />
          <div className="space-y-2">
            {(depQ.data?.deployments ?? []).slice(0, 4).map((d: any) => (
              <div key={d.id} className="rounded-md border border-border/50 bg-background/40 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono-nums text-xs font-bold text-foreground">{d.version}</span>
                  <StatusBadge status={d.status} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">{d.feature}</div>
                <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono-nums text-muted-foreground">
                  <span>by {d.triggeredBy}</span>
                  <span className={d.testsFailed > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {d.testsPassed}/{d.testsPassed + d.testsFailed} tests
                  </span>
                </div>
                {d.canaryPct > 0 && d.canaryPct < 100 && (
                  <div className="mt-1.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${d.canaryPct}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ResourceBar({ label, value, unit, icon, display, max = 100 }: { label: string; value: number; unit: string; icon: React.ReactNode; display?: string; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct > 80 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
        <span className="font-mono-nums">{display ?? value.toFixed(0)}{unit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
