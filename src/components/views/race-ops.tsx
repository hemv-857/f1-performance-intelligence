'use client'

import { useQuery } from '@tanstack/react-query'
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket'
import { SectionHeader, StatCard, StatusBadge } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Cpu, Database, Wind, ShieldCheck, AlertTriangle, Play, Zap, Activity, Server, GitBranch, RefreshCw, CircleCheck, Clock, Radio,
  Thermometer, Flame, Droplets, Sun, CloudSun, CloudRain, Gauge,
} from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

const PLAYBOOKS = [
  {
    id: 'kill-duplicate-workers',
    name: 'Kill duplicate Spark workers',
    trigger: 'Telemetry pipeline latency spiking',
    icon: Zap,
    steps: ['Detect duplicate workers via consumer-lag monitor', 'Terminate redundant Spark executors', 'Verify lag dropped to <1s', 'Log to incident history'],
    color: 'amber',
  },
  {
    id: 'failover-secondary',
    name: 'Failover to secondary buffer',
    trigger: 'Data-loss risk / primary ingest down',
    icon: GitBranch,
    steps: ['Primary ingest pod CrashLoop detected', 'Promote secondary Kafka buffer', 'Replay buffered samples (zero loss)', 'Arm primary rebuild'],
    color: 'red',
  },
  {
    id: 'rollback-deploy',
    name: 'Rollback failed deployment',
    trigger: 'Deployment failed regression tests',
    icon: RefreshCw,
    steps: ['Detect failed canary (regression < 0.75)', 'Auto-revert to previous stable', 'Verify <1 min rollback', 'Notify #f1-devops channel'],
    color: 'emerald',
  },
] as const

export function RaceOpsView({ socket }: { socket: ReturnType<typeof useTelemetrySocket> }) {
  const healthQ = useQuery({
    queryKey: ['health'],
    refetchInterval: 10000,
    queryFn: async () => (fetch('/api/devops/health')).then((r) => r.json()),
  })
  const alertsQ = useQuery({
    queryKey: ['alerts'],
    refetchInterval: 12000,
    queryFn: async () => (fetch('/api/devops/alerts')).then((r) => r.json()),
  })
  const incidentsQ = useQuery({
    queryKey: ['incidents'],
    refetchInterval: 20000,
    queryFn: async () => (fetch('/api/devops/incidents')).then((r) => r.json()),
  })

  const p = socket.pipeline
  const healthy = p?.primaryHealthy ?? true

  const runPlaybook = (pb: typeof PLAYBOOKS[number]) => {
    socket.runPlaybook(pb.id)
    toast.info(`Executing playbook: ${pb.name}`, { description: pb.trigger })
  }

  const runSynthetic = () => {
    socket.runSyntheticRace()
    toast.info('Synthetic race simulation started', { description: 'Stress-testing all telemetry pipelines for 3s' })
  }

  // live consumer-lag sparkline (from socket pipeline updates)
  const lagHistory = Array.from({ length: 30 }, (_, i) => ({
    i,
    lag: Math.max(200, (p?.consumerLagMs ?? 400) + Math.sin(i / 3) * 120 + (i % 7) * 30),
  }))

  return (
    <div className="space-y-4">
      {/* Hero status */}
      <Card className={cn('relative overflow-hidden border bg-card/60',
        healthy ? 'border-emerald-500/30' : 'border-red-500/40')}>
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={cn('h-14 w-14 rounded-xl flex items-center justify-center shrink-0',
            healthy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400 pulse-red')}>
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">Race-Weekend Pipeline Status</h2>
              <StatusBadge status={healthy ? 'healthy' : 'active'} />
              {p?.secondaryBufferArmed && <StatusBadge status="armed" />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {healthy
                ? 'All telemetry pipelines nominal. Primary Kafka + Spark streaming healthy, secondary buffer disarmed.'
                : 'Primary pipeline degraded — failover to secondary buffer active. Zero data loss guarantee holding.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runSynthetic} className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
              <Play className="h-3.5 w-3.5 mr-1" /> Synthetic race sim
            </Button>
          </div>
        </div>
        {socket.synthetic.phase === 'start' && (
          <div className="relative px-5 py-2 border-t border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs font-mono-nums flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> {socket.synthetic.message}
          </div>
        )}
        {socket.synthetic.phase === 'done' && (
          <div className="relative px-5 py-2 border-t border-emerald-500/30 bg-emerald-500/5 text-emerald-300 text-xs font-mono-nums flex items-center gap-2">
            <CircleCheck className="h-3.5 w-3.5" /> {socket.synthetic.message} · {socket.synthetic.result?.checksPassed} checks passed, {socket.synthetic.result?.checksFailed} failed, latency p99 {socket.synthetic.result?.latencyP99}ms.
          </div>
        )}
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pipeline uptime" value={(p?.uptimePct ?? 99.97).toFixed(2)} unit="%" sub="Target 99.9% race events" accent="emerald" icon={<Activity className="h-4 w-4" />} spark={[99.9, 99.93, 99.95, 99.97, 99.96, 99.98, 99.97, 99.97]} />
        <StatCard label="Consumer lag" value={((p?.consumerLagMs ?? 400) / 1000).toFixed(2)} unit="s" sub={healthy ? 'nominal' : 'spiking'} accent={healthy ? 'emerald' : 'red'} icon={<Clock className="h-4 w-4" />} spark={lagHistory.map((d) => d.lag)} />
        <StatCard label="Ingest rate" value={(p?.ingestRateHz ?? 1000).toLocaleString()} unit="Hz" sub="100+ channels × 2 cars" accent="amber" icon={<Radio className="h-4 w-4" />} spark={[980, 1000, 1000, 1010, 1000, 1005, 1000, 1000]} />
        <StatCard label="Data loss" value="0" unit="samples" sub="guarantee holding" accent="emerald" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      {/* Weather & track conditions */}
      <WeatherPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Service health grid */}
        <Card className="lg:col-span-2 border-border/50 bg-card/60">
          <SectionHeader title="Service monitoring" subtitle="CPU / memory / network · all services · race-edge region" right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-emerald-500/40 text-emerald-300">{(healthQ.data?.services ?? []).filter((s: any) => s.status === 'healthy').length}/{(healthQ.data?.services ?? []).length} healthy</Badge>
          } />
          <div className="px-4 pb-4 space-y-2">
            {healthQ.data?.services?.map((s: any) => (
              <div key={s.name} className="rounded-md border border-border/50 bg-background/40 p-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('h-2 w-2 rounded-full shrink-0',
                      s.status === 'healthy' ? 'bg-emerald-400' : s.status === 'armed' ? 'bg-amber-400 blink' : 'bg-red-400 blink')} />
                    <span className="font-mono-nums text-xs font-bold truncate">{s.name}</span>
                    <Badge variant="outline" className="text-[9px] font-mono-nums text-muted-foreground">{s.component}</Badge>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">{s.region}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono-nums text-muted-foreground">
                    <span>{s.instances} pods</span>
                    <span className={cn(s.latencyMs > 2000 ? 'text-amber-400' : 'text-foreground')}>{s.latencyMs}ms</span>
                    <span>{s.uptimePct}%</span>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <MiniBar label="CPU" value={38 + (s.latencyMs % 30)} unit="%" />
                  <MiniBar label="MEM" value={50 + (s.instances * 4)} unit="%" />
                  <MiniBar label="RPS" value={Math.min(100, (s.rps / 60))} display={`${s.rps}`} unit="" />
                </div>
              </div>
            ))}
          </div>
          {/* resource averages */}
          <div className="px-4 pb-4 grid grid-cols-3 gap-2">
            <MiniBar label="Cluster CPU avg" value={healthQ.data?.resourceAverages?.cpuPct ?? 42} unit="%" icon={<Cpu className="h-3 w-3" />} />
            <MiniBar label="Cluster MEM avg" value={healthQ.data?.resourceAverages?.memPct ?? 58} unit="%" icon={<Database className="h-3 w-3" />} />
            <MiniBar label="Network" value={((healthQ.data?.resourceAverages?.networkGbps ?? 4.5) / 8) * 100} display={`${(healthQ.data?.resourceAverages?.networkGbps ?? 4.5).toFixed(2)}`} unit="Gbps" icon={<Wind className="h-3 w-3" />} max={100} />
          </div>
        </Card>

        {/* Consumer lag trend */}
        <Card className="border-border/50 bg-card/60 card-hover">
          <SectionHeader title="Consumer lag (live)" subtitle="Kafka → Spark" />
          <div className="h-[180px] px-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lagHistory} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="i" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="s" />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${((v as number) / 1000).toFixed(2)}s`, 'Lag']} />
                <Line dataKey="lag" stroke={healthy ? '#34d399' : '#f87171'} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="px-4 pb-3 text-[10px] text-muted-foreground font-mono-nums text-center">
            ALERT THRESHOLD: 5.0s · {healthy ? 'NORMAL' : 'BREACHED'}
          </div>
        </Card>
      </div>

      {/* Incident playbook */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card/60 card-hover">
          <SectionHeader title="Incident playbook" subtitle="Auto-action on trigger · manual run available" />
          <div className="px-4 pb-4 space-y-2">
            {PLAYBOOKS.map((pb) => {
              const Icon = pb.icon
              const colorMap: Record<string, string> = {
                amber: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10',
                red: 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10',
                emerald: 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10',
              }
              const iconColor: Record<string, string> = { amber: 'text-amber-400', red: 'text-red-400', emerald: 'text-emerald-400' }
              return (
                <div key={pb.id} className={cn('rounded-lg border p-3 transition-colors', colorMap[pb.color])}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconColor[pb.color])} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{pb.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Trigger: {pb.trigger}</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" onClick={() => runPlaybook(pb)}>
                      <Play className="h-3 w-3 mr-1" /> Run
                    </Button>
                  </div>
                  <ol className="mt-2 space-y-0.5 text-[10px] text-muted-foreground font-mono-nums">
                    {pb.steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}
                  </ol>
                </div>
              )
            })}
          </div>
          {socket.playbookResult && (
            <div className="mx-4 mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-medium">
                <CircleCheck className="h-4 w-4" /> Playbook completed in {(socket.playbookResult.durationMs / 1000).toFixed(1)}s
              </div>
              <ol className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground font-mono-nums">
                {socket.playbookResult.steps.map((s: string, i: number) => <li key={i}>✓ {s}</li>)}
              </ol>
            </div>
          )}
          {socket.recovered && (
            <div className="mx-4 mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-300">
              {socket.recovered}
            </div>
          )}
          {socket.incident && (
            <div className="mx-4 mb-4 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-[11px] text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> {socket.incident.message}
            </div>
          )}
        </Card>

        {/* Incident history */}
        <Card className="border-border/50 bg-card/60 card-hover">
          <SectionHeader title="Incident history" subtitle="Auto-resolved playbook runs" right={
            <Badge variant="outline" className="font-mono-nums text-[10px]">{(incidentsQ.data?.incidents ?? []).length} runs</Badge>
          } />
          <div className="px-4 pb-4 space-y-2 max-h-[420px] overflow-y-auto">
            {(incidentsQ.data?.incidents ?? []).map((inc: any) => (
              <div key={inc.id} className="rounded-md border border-border/50 bg-background/40 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono-nums text-xs font-bold truncate">{inc.playbook}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={cn('font-mono-nums text-[9px]',
                      inc.durationMs < 60000 ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300')}>
                      {(inc.durationMs / 1000).toFixed(1)}s
                    </Badge>
                    <StatusBadge status={inc.status} />
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Trigger: {inc.trigger}</div>
                <ol className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground font-mono-nums">
                  {inc.actions.map((a: string, i: number) => <li key={i}>→ {a}</li>)}
                </ol>
              </div>
            ))}
            {(!incidentsQ.data?.incidents || incidentsQ.data.incidents.length === 0) && (
              <div className="text-center py-8 text-sm text-muted-foreground">No incidents recorded</div>
            )}
          </div>
        </Card>
      </div>

      {/* Pre-race health checks */}
      <Card className="border-border/50 bg-card/60 card-hover">
        <SectionHeader title="Pre-race health checks" subtitle="Synthetic race simulation stress-tests all pipelines before lights-out" right={
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={runSynthetic}>
            <Play className="h-3.5 w-3.5 mr-1" /> Run full check
          </Button>
        } />
        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { name: 'Kafka ingest throughput', target: '6,000 Hz', ok: true },
            { name: 'Spark 5s aggregation lag', target: '<5s', ok: true },
            { name: 'Snowflake WH resume', target: '<2s', ok: true },
            { name: 'Socket.IO broadcast', target: '10 Hz', ok: true },
            { name: 'Secondary buffer failover', target: 'zero loss', ok: true },
            { name: 'K8s pod readiness', target: '6/6 ready', ok: true },
            { name: 'dbt model freshness', target: '<60s', ok: true },
            { name: 'Alert routing', target: 'PagerDuty ✓', ok: true },
          ].map((c) => (
            <div key={c.name} className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
              <div className="flex items-center gap-1.5">
                <CircleCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-medium truncate">{c.name}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono-nums mt-1">target {c.target}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function MiniBar({ label, value, unit, display, icon, max = 100 }: { label: string; value: number; unit: string; display?: string; icon?: React.ReactNode; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct > 80 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="flex items-center gap-1 text-muted-foreground">{icon}{label}</span>
        <span className="font-mono-nums">{display ?? Math.round(value)}{unit}</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ---- Weather & Track Conditions panel ----
function WeatherPanel() {
  // Simulate live weather evolution with a stable seed (updates every render from a base model)
  const base = 26.5 // air temp base (Singapore Q)
  const tbase = 37.5 // track temp base
  const now = Date.now() / 1000
  const airTemp = base + Math.sin(now / 120) * 1.2 + Math.sin(now / 30) * 0.3
  const trackTemp = tbase + Math.sin(now / 90) * 2.5 + Math.sin(now / 25) * 0.6
  const windSpeed = 4.2 + Math.abs(Math.sin(now / 60)) * 3.8
  const windDir = ((now / 20) % 360)
  const humidity = 78 + Math.sin(now / 100) * 6
  const pressure = 1009 + Math.sin(now / 200) * 2
  const trackEvolution = Math.min(100, 42 + (now % 600) / 12) // track grip improving over the session

  // 30-point history for the temp trend chart
  const tempHistory = Array.from({ length: 30 }, (_, i) => ({
    i,
    air: base + Math.sin((now - (29 - i) * 60) / 120) * 1.2,
    track: tbase + Math.sin((now - (29 - i) * 60) / 90) * 2.5,
  }))

  const rainRisk = humidity > 85 && pressure < 1008 ? 'ELEVATED' : 'LOW'
  const gripLabel = trackEvolution > 80 ? 'OPTIMAL' : trackEvolution > 55 ? 'IMPROVING' : 'GREEN/SLIPPERY'
  const gripColor = trackEvolution > 80 ? 'text-emerald-300' : trackEvolution > 55 ? 'text-amber-300' : 'text-red-300'

  return (
    <Card className="border-border/50 bg-card/60 card-hover">
      <SectionHeader
        title="Weather & Track Conditions"
        subtitle="Live meteorological feed · track evolution index · Singapore Marina Bay"
        right={
          <Badge variant="outline" className="font-mono-nums text-[10px] border-emerald-500/40 text-emerald-300">
            <CloudSun className="h-3 w-3 mr-1" /> DRY · 28°C
          </Badge>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.2fr] gap-4 px-4 pb-4">
        {/* Current conditions grid */}
        <div className="grid grid-cols-2 gap-3">
          <WeatherStat icon={<Thermometer className="h-3.5 w-3.5" />} label="Air temp" value={airTemp.toFixed(1)} unit="°C" accent="text-amber-300" />
          <WeatherStat icon={<Flame className="h-3.5 w-3.5" />} label="Track temp" value={trackTemp.toFixed(1)} unit="°C" accent="text-red-300" sub={`Δ ${(trackTemp - airTemp).toFixed(1)}°C`} />
          <WeatherStat icon={<Wind className="h-3.5 w-3.5" />} label="Wind" value={windSpeed.toFixed(1)} unit="m/s" sub={`${windDir.toFixed(0)}°`} accent="text-emerald-300" />
          <WeatherStat icon={<Droplets className="h-3.5 w-3.5" />} label="Humidity" value={humidity.toFixed(0)} unit="%" accent={humidity > 85 ? 'text-amber-300' : 'text-emerald-300'} />
          <WeatherStat icon={<Gauge className="h-3.5 w-3.5" />} label="Pressure" value={pressure.toFixed(0)} unit="hPa" accent="text-emerald-300" />
          <WeatherStat icon={<Sun className="h-3.5 w-3.5" />} label="UV index" value="3.2" unit="" accent="text-amber-300" />
        </div>

        {/* Temp trend chart */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums mb-1">Air vs Track temp trend (30 min)</div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tempHistory} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="i" tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} unit="°" domain={[20, 45]} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 11 }} labelFormatter={(v) => `${30 - (v as number)} min ago`} />
                <Line dataKey="air" name="Air" stroke="#fbbf24" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line dataKey="track" name="Track" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-mono-nums text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-amber-400" /> Air</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-red-400" /> Track</span>
          </div>
        </div>

        {/* Track evolution + rain risk */}
        <div className="space-y-3">
          {/* Track evolution gauge */}
          <div className="rounded-md border border-border/50 bg-background/40 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums flex items-center gap-1">
                <Activity className="h-3 w-3" /> Track evolution
              </span>
              <span className={cn('text-[11px] font-bold font-mono-nums', gripColor)}>{gripLabel}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={cn('h-full transition-all', trackEvolution > 80 ? 'bg-emerald-500' : trackEvolution > 55 ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: `${trackEvolution}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] font-mono-nums text-muted-foreground">
              <span>GREEN</span>
              <span className="text-foreground font-bold">{trackEvolution.toFixed(0)}%</span>
              <span>OPTIMAL</span>
            </div>
          </div>

          {/* Rain risk */}
          <div className={cn('rounded-md border p-3', rainRisk === 'ELEVATED' ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5')}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums flex items-center gap-1">
                <CloudRain className="h-3 w-3" /> Rain risk
              </span>
              <span className={cn('text-[11px] font-bold font-mono-nums', rainRisk === 'ELEVATED' ? 'text-amber-300' : 'text-emerald-300')}>{rainRisk}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {rainRisk === 'ELEVATED'
                ? 'Pressure dropping + high humidity — monitor for incoming shower. Inter tires on standby.'
                : 'Stable pressure + moderate humidity. Dry running expected to continue.'}
            </p>
          </div>

          {/* Wind direction compass */}
          <div className="rounded-md border border-border/50 bg-background/40 p-3 flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-full border border-border/60 flex items-center justify-center shrink-0">
              <span className="absolute top-0.5 text-[8px] text-muted-foreground font-mono-nums">N</span>
              <span className="absolute bottom-0.5 text-[8px] text-muted-foreground font-mono-nums">S</span>
              <svg viewBox="0 0 40 40" className="h-10 w-10" style={{ transform: `rotate(${windDir}deg)` }}>
                <path d="M20 6 L24 22 L20 18 L16 22 Z" fill="#f87171" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Wind direction</div>
              <div className="font-mono-nums text-sm font-bold">{windDir.toFixed(0)}° <span className="text-muted-foreground text-[10px]">{dirLabel(windDir)}</span></div>
              <div className="text-[10px] text-muted-foreground mt-0.5">crosswind on S2 main straight</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function WeatherStat({ icon, label, value, unit, sub, accent = 'text-foreground' }: { icon: React.ReactNode; label: string; value: string; unit?: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
        {icon}{label}
      </div>
      <div className={cn('mt-1 font-mono-nums text-lg font-bold', accent)}>
        {value}{unit && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5 font-mono-nums">{sub}</div>}
    </div>
  )
}

function dirLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}
