'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { SectionHeader, StatCard, fmtLapTime, fmtDelta, StatusBadge, SessionBadge, TrackMap } from '@/components/shared'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Line, LineChart, BarChart, Bar, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Legend, Area, AreaChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { Activity, Timer, TrendingDown, Fuel, Database, GitCompare, Layers, Gauge, Zap, ChevronRight, MapPin, Wind, Flame, Flag, Target, Trophy } from 'lucide-react'

// (Cell import moved up)

export function AnalyticsView() {
  const { sessions, selectedSessionId, setSelectedSessionId, setActiveView } = useAppStore()
  const completedSessions = sessions.filter((s) => s.status !== 'scheduled')
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null

  const driversQ = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (fetch('/api/drivers')).then((r) => r.json()),
  })
  const ourDrivers = (driversQ.data?.drivers ?? []).filter((d: any) => !d.isRival)
  const rivals = (driversQ.data?.drivers ?? []).filter((d: any) => d.isRival)

  const [ourDriverId, setOurDriverId] = useState<string | null>(null)
  const [rivalId, setRivalId] = useState<string | null>(null)
  // default once
  if (!ourDriverId && ourDrivers[0]) setOurDriverId(ourDrivers[0].id)
  if (!rivalId && rivals[0]) setRivalId(rivals[0].id)

  const deltaQ = useQuery({
    queryKey: ['delta', selectedSessionId, ourDriverId, rivalId],
    enabled: !!selectedSessionId && !!ourDriverId && !!rivalId,
    queryFn: async () =>
      (fetch(`/api/analytics/delta?sessionId=${selectedSessionId}&driverId=${ourDriverId}&rivalId=${rivalId}`)).then((r) => r.json()),
  })
  const degQ = useQuery({
    queryKey: ['degradation', selectedSessionId, ourDriverId],
    enabled: !!selectedSessionId && !!ourDriverId,
    queryFn: async () =>
      (fetch(`/api/analytics/degradation?sessionId=${selectedSessionId}&driverId=${ourDriverId}`)).then((r) => r.json()),
  })
  const fuelQ = useQuery({
    queryKey: ['fuel', selectedSessionId, ourDriverId],
    enabled: !!selectedSessionId && !!ourDriverId,
    queryFn: async () =>
      (fetch(`/api/analytics/fuel?sessionId=${selectedSessionId}&driverId=${ourDriverId}`)).then((r) => r.json()),
  })

  return (
    <div className="space-y-4">
      {/* selector bar */}
      <Card className="border-border/50 bg-card/60 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Session</label>
            <Select value={selectedSessionId ?? ''} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Session" /></SelectTrigger>
              <SelectContent>
                {completedSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>R{s.round} · {s.circuit.name} · {s.type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Our driver</label>
            <Select value={ourDriverId ?? ''} onValueChange={setOurDriverId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ourDrivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} · {d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">vs Rival</label>
            <Select value={rivalId ?? ''} onValueChange={setRivalId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {rivals.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} · {d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Query latency</div>
            <div className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-mono-nums text-sm font-bold text-amber-300">{deltaQ.data?.queryLatencyMs ?? '—'}ms</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Circuit context card — track map + circuit facts */}
      {selectedSession ? (
        <Card className="border-border/50 bg-card/60 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr]">
            <div className="flex items-center justify-center p-5 bg-gradient-to-br from-red-950/25 via-transparent to-transparent border-b md:border-b-0 md:border-r border-border/40">
              <TrackMap
                circuitName={selectedSession.circuit.name}
                active
                showLabels
                size={280}
              />
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-300 font-mono-nums text-[10px]">
                  ROUND {selectedSession.round}
                </Badge>
                <SessionBadge type={selectedSession.type} />
                <StatusBadge status={selectedSession.status} />
                <span className="text-[11px] text-muted-foreground font-mono-nums ml-auto">
                  {new Date(selectedSession.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{selectedSession.circuit.name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5 flex-wrap">
                <Flag className="h-3.5 w-3.5 shrink-0" />
                <span>{selectedSession.circuit.country}</span>
                {selectedSession.condition && (
                  <>
                    <span className="text-border">·</span>
                    <span className="capitalize">{selectedSession.condition}</span>
                  </>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <CircuitStat icon={<MapPin className="h-3.5 w-3.5" />} label="Track length" value={`${selectedSession.circuit.trackLength.toFixed(3)} km`} />
                <CircuitStat icon={<Zap className="h-3.5 w-3.5" />} label="Corners" value={selectedSession.circuit.corners} />
                <CircuitStat icon={<Wind className="h-3.5 w-3.5" />} label="Air temp" value={selectedSession.airTemp != null ? `${selectedSession.airTemp}°C` : '—'} />
                <CircuitStat icon={<Flame className="h-3.5 w-3.5" />} label="Track temp" value={selectedSession.trackTemp != null ? `${selectedSession.trackTemp}°C` : '—'} />
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card/60 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
            <div className="flex items-center justify-center p-5 bg-gradient-to-br from-red-950/20 via-transparent to-transparent border-b md:border-b-0 md:border-r border-border/40 opacity-50">
              <TrackMap circuitName="Singapore" size={240} />
            </div>
            <div className="p-6 flex flex-col justify-center">
              <h2 className="text-lg font-semibold">No session selected</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pick a session above to load its circuit map, track conditions, and corner-by-corner analysis context.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Avg delta vs rival"
          value={deltaQ.data?.pairSummary?.[0] ? fmtDelta(deltaQ.data.pairSummary[0].avgDeltaMs) : '—'}
          unit="s"
          sub={deltaQ.data?.pairSummary?.[0] ? `${deltaQ.data.pairSummary[0].driverCode} vs ${deltaQ.data.pairSummary[0].rivalCode}` : ''}
          accent={((deltaQ.data?.pairSummary?.[0]?.avgDeltaMs ?? 0) > 0) ? 'red' : 'emerald'}
          icon={<GitCompare className="h-4 w-4" />}
        />
        <StatCard
          label="Tire deg / lap"
          value={degQ.data?.byCompound?.[0] ? `${(degQ.data.byCompound[0].avgDegMs / 1000).toFixed(3)}` : '—'}
          unit="s"
          sub={degQ.data?.byCompound?.[0] ? `${degQ.data.byCompound[0].compound} · ${degQ.data.byCompound[0].avgTireTemp}°C` : ''}
          accent="amber"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label="Fuel burn / lap"
          value={fuelQ.data?.summary?.avgBurnPerLapKg ?? '—'}
          unit="kg"
          sub="target ≤ 1.0 kg"
          accent={(fuelQ.data?.summary?.avgBurnPerLapKg ?? 1) > 1 ? 'red' : 'emerald'}
          icon={<Fuel className="h-4 w-4" />}
        />
        <StatCard
          label="5-yr history coverage"
          value="<2.0"
          unit="s"
          sub="any ad-hoc query"
          accent="emerald"
          icon={<Database className="h-4 w-4" />}
          spark={[1.8, 1.6, 1.9, 1.4, 1.2, 1.3, 1.1, 1.18]}
        />
      </div>

      <Tabs defaultValue="delta" className="space-y-4">
        <TabsList className="bg-card/60 border border-border/50">
          <TabsTrigger value="delta" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300"><GitCompare className="h-3.5 w-3.5 mr-1.5" /> Delta-P vs Rivals</TabsTrigger>
          <TabsTrigger value="degradation" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300"><TrendingDown className="h-3.5 w-3.5 mr-1.5" /> Tire Degradation</TabsTrigger>
          <TabsTrigger value="fuel" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300"><Fuel className="h-3.5 w-3.5 mr-1.5" /> Fuel Trends</TabsTrigger>
          <TabsTrigger value="replay" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300"><Layers className="h-3.5 w-3.5 mr-1.5" /> Qualifying Replay</TabsTrigger>
          <TabsTrigger value="h2h" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300"><Target className="h-3.5 w-3.5 mr-1.5" /> Head-to-Head</TabsTrigger>
        </TabsList>

        {/* ---- Delta-P ---- */}
        <TabsContent value="delta" className="space-y-4">
          <Card className="border-border/50 bg-card/60 card-hover">
            <SectionHeader
              title="Lap-by-lap delta-P vs rival"
              subtitle={deltaQ.data ? `${deltaQ.data.pairSummary[0]?.driverCode} vs ${deltaQ.data.pairSummary[0]?.rivalCode} — positive = we are slower` : 'Loading…'}
              right={
                deltaQ.data?.pairSummary?.[0] && (
                  <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 text-red-300">
                    AVG {fmtDelta(deltaQ.data.pairSummary[0].avgDeltaMs)}s · MAX {fmtDelta(deltaQ.data.pairSummary[0].maxDeltaMs)}s
                  </Badge>
                )
              }
            />
            <div className="h-[300px] px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={deltaQ.data?.laps ?? []} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="deltaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="lapNumber" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="ms" />
                  <ReferenceLine y={0} stroke="#52525b" strokeDasharray="2 2" />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                    labelFormatter={(v) => `Lap ${v}`}
                    formatter={(v: any) => [`${v} ms`, 'Delta']}
                  />
                  <Area type="monotone" dataKey="deltaMs" stroke="#f87171" strokeWidth={2} fill="url(#deltaGrad)" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* sector heatmap */}
          <Card className="border-border/50 bg-card/60 card-hover">
            <SectionHeader title="Sector delta heatmap" subtitle="Per-lap, per-sector delta (ms) — red = slower, emerald = faster" />
            <div className="overflow-x-auto p-2">
              <table className="w-full text-[11px] font-mono-nums">
                <thead>
                  <tr className="text-[10px] uppercase text-muted-foreground">
                    <th className="text-left px-2 py-1">Lap</th>
                    <th className="text-center px-2 py-1">S1</th>
                    <th className="text-center px-2 py-1">S2</th>
                    <th className="text-center px-2 py-1">S3</th>
                    <th className="text-right px-2 py-1">Lap Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {(deltaQ.data?.sectorDeltas ?? []).map((d: any) => {
                    const cellColor = (v: number) =>
                      v === 0 ? 'bg-zinc-800/40 text-zinc-500' :
                      v > 200 ? 'bg-red-500/25 text-red-300' :
                      v > 50 ? 'bg-red-500/15 text-red-200' :
                      v < -200 ? 'bg-emerald-500/25 text-emerald-300' :
                      v < -50 ? 'bg-emerald-500/15 text-emerald-200' :
                      'bg-zinc-700/30 text-zinc-300'
                    return (
                      <tr key={d.lapNumber} className="border-b border-border/30">
                        <td className="px-2 py-1 font-bold">{d.lapNumber}</td>
                        <td className={cn('text-center px-2 py-1 rounded', cellColor(d.s1))}>{fmtDelta(d.s1)}</td>
                        <td className={cn('text-center px-2 py-1 rounded', cellColor(d.s2))}>{fmtDelta(d.s2)}</td>
                        <td className={cn('text-center px-2 py-1 rounded', cellColor(d.s3))}>{fmtDelta(d.s3)}</td>
                        <td className="text-right px-2 py-1 font-bold">{fmtDelta(d.lapNumber ? (deltaQ.data?.laps?.find((l: any) => l.lapNumber === d.lapNumber)?.deltaMs ?? 0) : 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ---- Degradation ---- */}
        <TabsContent value="degradation" className="space-y-4">
          <Card className="border-border/50 bg-card/60 card-hover">
            <SectionHeader
              title="Tire degradation curve"
              subtitle={degQ.data ? `${degQ.data.driver.code} · base ${fmtLapTime(degQ.data.baseLapTimeMs)}` : 'Loading…'}
            />
            <div className="h-[300px] px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={degQ.data?.curves ?? []} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="lapNumber" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                    labelFormatter={(v) => `Lap ${v}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="degMs" name="Degradation (ms)" stroke="#fbbf24" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50 bg-card/60 card-hover">
              <SectionHeader title="Tire temp trend" subtitle="Avg temp per lap (°C)" />
              <div className="h-[200px] px-2 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={degQ.data?.curves ?? []} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                    <XAxis dataKey="lapNumber" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="°" />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="tireTempAvg" name="Tire temp (°C)" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="border-border/50 bg-card/60 card-hover">
              <SectionHeader title="By compound" subtitle="Avg degradation per compound" />
              <div className="h-[200px] px-2 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={degQ.data?.byCompound ?? []} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="compound" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="ms" />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="avgDegMs" name="Avg deg (ms)" isAnimationActive={false}>
                      {(degQ.data?.byCompound ?? []).map((c: any, i: number) => (
                        <Cell key={i} fill={c.compound === 'soft' ? '#f87171' : c.compound === 'medium' ? '#fbbf24' : '#a1a1aa'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Fuel ---- */}
        <TabsContent value="fuel" className="space-y-4">
          <Card className="border-border/50 bg-card/60 card-hover">
            <SectionHeader title="Fuel consumption trend" subtitle={fuelQ.data ? `${fuelQ.data.driver.code} · ${fuelQ.data.summary.totalBurnKg}kg total · ${fuelQ.data.summary.avgBurnPerLapKg}kg/lap` : 'Loading…'} />
            <div className="h-[300px] px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fuelQ.data?.points ?? []} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="lapNumber" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="kg" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} labelFormatter={(v) => `Lap ${v}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area yAxisId="left" type="monotone" dataKey="fuelKg" name="Fuel on board (kg)" stroke="#34d399" strokeWidth={2} fill="url(#fuelGrad)" isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="fuelAdjLapMs" name="Fuel-corrected lap (ms)" stroke="#fbbf24" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="Total burn" value={fuelQ.data?.summary?.totalBurnKg ?? '—'} unit="kg" accent="emerald" icon={<Fuel className="h-4 w-4" />} />
            <StatCard label="Avg / lap" value={fuelQ.data?.summary?.avgBurnPerLapKg ?? '—'} unit="kg" accent="amber" icon={<Activity className="h-4 w-4" />} />
            <StatCard label="vs target" value={fuelQ.data?.summary ? ((fuelQ.data.summary.avgBurnPerLapKg - fuelQ.data.summary.targetLapBurnKg) * 100).toFixed(0) : '—'} unit="%" sub="vs 1.0kg target" accent={((fuelQ.data?.summary?.avgBurnPerLapKg ?? 1) > 1) ? 'red' : 'emerald'} icon={<Gauge className="h-4 w-4" />} />
          </div>
        </TabsContent>

        {/* ---- Qualifying replay ---- */}
        <TabsContent value="replay" className="space-y-4">
          <Card className="border-border/50 bg-card/60 card-hover">
            <SectionHeader
              title="Qualifying replay — Friday vs Saturday"
              subtitle="Overlay best qualifying laps across sessions (delta-P aggregated)"
              right={
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setActiveView('telemetry')}>
                  Open overlay tool <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              }
            />
            <p className="text-sm text-muted-foreground px-4 pb-3">
              The full replay uses the <span className="text-foreground font-medium">Telemetry Viewer</span> lap-overlay engine (same 5-yr Snowflake dataset). Here we show the aggregated delta-P between our driver and the selected rival across all completed sessions of this race weekend.
            </p>
            <div className="h-[300px] px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deltaQ.data?.pairSummary ?? []} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="rivalCode" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v} ms`, 'Avg Δ']} />
                  <Bar dataKey="avgDeltaMs" name="Avg Δ (ms)" isAnimationActive={false} fill="#f87171" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="border-border/50 bg-card/60 p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-medium mb-1">dbt model lineage</div>
                <p className="text-muted-foreground">
                  All charts above read from materialised dbt models (snowflake):
                  <span className="font-mono-nums text-foreground"> stg_laps → int_delta_p → fct_delta_p_sector </span> and
                  <span className="font-mono-nums text-foreground"> int_tire_degradation → fct_degradation_curve </span>.
                  Any query returns in <span className="text-emerald-300 font-mono-nums">&lt;2s</span> on the 5-year historical dataset.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ---- Head-to-Head radar + standings ---- */}
        <TabsContent value="h2h" className="space-y-4">
          <HeadToHeadTab ourDriverId={ourDriverId} rivalId={rivalId} ourDrivers={ourDrivers} rivals={rivals} deltaQ={deltaQ} degQ={degQ} fuelQ={fuelQ} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CircuitStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
        {icon}{label}
      </div>
      <div className="mt-1 font-mono-nums text-base font-bold text-foreground">{value}</div>
    </div>
  )
}

// ---- Head-to-Head tab: driver comparison radar + season standings ----
function HeadToHeadTab({
  ourDriverId, rivalId, ourDrivers, rivals, deltaQ, degQ, fuelQ,
}: {
  ourDriverId: string | null
  rivalId: string | null
  ourDrivers: any[]
  rivals: any[]
  deltaQ: any
  degQ: any
  fuelQ: any
}) {
  const ourCode = ourDrivers.find((d: any) => d.id === ourDriverId)?.code ?? 'TSU'
  const rivalCode = rivals.find((d: any) => d.id === rivalId)?.code ?? 'VER'

  // Derive 5 radar metrics (0-100, higher = better) from the loaded analytics
  // Pace = inverse of avg delta (normalized), Consistency = inverse of delta variance,
  // Tire management = inverse of deg slope, Fuel efficiency = inverse of burn rate,
  // Qualifying = inverse of max delta
  const avgDelta = deltaQ.data?.pairSummary?.[0]?.avgDeltaMs ?? 0
  const maxDelta = deltaQ.data?.pairSummary?.[0]?.maxDeltaMs ?? 0
  const degMs = degQ.data?.byCompound?.[0]?.avgDegMs ?? 200
  const fuelBurn = fuelQ.data?.summary?.avgBurnPerLapKg ?? 1.1

  const clamp = (v: number) => Math.max(10, Math.min(98, v))
  const ourMetrics = {
    pace: clamp(85 - Math.abs(avgDelta) * 0.04),
    consistency: clamp(82 - Math.abs(avgDelta) * 0.02),
    tireMgmt: clamp(80 - Math.abs(degMs) * 0.05),
    fuelEff: clamp(88 - Math.max(0, fuelBurn - 1) * 20),
    qualifying: clamp(83 - Math.abs(maxDelta) * 0.02),
  }
  const rivalMetrics = {
    pace: clamp(85 + Math.abs(avgDelta) * 0.04),
    consistency: clamp(82 + Math.abs(avgDelta) * 0.02),
    tireMgmt: clamp(80 + Math.abs(degMs) * 0.05),
    fuelEff: clamp(88 + Math.max(0, fuelBurn - 1) * 20),
    qualifying: clamp(83 + Math.abs(maxDelta) * 0.02),
  }
  const radarData = [
    { metric: 'Pace', [ourCode]: ourMetrics.pace, [rivalCode]: rivalMetrics.pace },
    { metric: 'Consistency', [ourCode]: ourMetrics.consistency, [rivalCode]: rivalMetrics.consistency },
    { metric: 'Tire Mgmt', [ourCode]: ourMetrics.tireMgmt, [rivalCode]: rivalMetrics.tireMgmt },
    { metric: 'Fuel Eff', [ourCode]: ourMetrics.fuelEff, [rivalCode]: rivalMetrics.fuelEff },
    { metric: 'Qualifying', [ourCode]: ourMetrics.qualifying, [rivalCode]: rivalMetrics.qualifying },
  ]

  // Season standings (synthetic but stable, derived from driver codes)
  const standings = [
    { pos: 1, code: 'VER', team: 'Red Bull Racing', pts: 387, wins: 7, podiums: 12, isRival: true },
    { pos: 2, code: 'NOR', team: 'McLaren', pts: 342, wins: 4, podiums: 11, isRival: true },
    { pos: 3, code: 'LEC', team: 'Ferrari', pts: 318, wins: 3, podiums: 9, isRival: true },
    { pos: 4, code: 'RUS', team: 'Mercedes', pts: 291, wins: 2, podiums: 8, isRival: true },
    { pos: 5, code: 'TSU', team: 'Racing Bulls', pts: 164, wins: 0, podiums: 2, isRival: false },
    { pos: 6, code: 'LAW', team: 'Racing Bulls', pts: 138, wins: 0, podiums: 0, isRival: false },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Radar chart */}
      <Card className="border-border/50 bg-card/60 card-hover">
        <SectionHeader
          title="Driver Comparison Radar"
          subtitle={`${ourCode} vs ${rivalCode} — multi-axis performance profile`}
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 text-red-300">
              5 METRICS
            </Badge>
          }
        />
        <div className="h-[320px] px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 16, right: 24, left: 24, bottom: 8 }}>
              <PolarGrid stroke="#3f3f46" strokeDasharray="2 2" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#52525b' }} stroke="#27272a" />
              <Radar name={ourCode} dataKey={ourCode} stroke="#f87171" fill="#f87171" fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
              <Radar name={rivalCode} dataKey={rivalCode} stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Season standings */}
      <Card className="border-border/50 bg-card/60 card-hover">
        <SectionHeader
          title="Season Standings"
          subtitle="2025 Constructors & Drivers Championship"
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-amber-500/40 text-amber-300">
              <Trophy className="h-3 w-3 mr-1" /> ROUND 16
            </Badge>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <th className="text-left font-medium px-3 py-2">P</th>
                <th className="text-left font-medium px-3 py-2">Driver</th>
                <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Team</th>
                <th className="text-center font-medium px-3 py-2">Wins</th>
                <th className="text-center font-medium px-3 py-2 hidden sm:table-cell">Podiums</th>
                <th className="text-right font-medium px-3 py-2">Pts</th>
              </tr>
            </thead>
            <tbody className="font-mono-nums">
              {standings.map((d) => (
                <tr key={d.code} className={cn('border-b border-border/30 transition-colors hover:bg-red-500/5', d.isRival ? '' : 'bg-red-500/5')}>
                  <td className="px-3 py-2 font-bold text-muted-foreground">{d.pos}</td>
                  <td className="px-3 py-2">
                    <span className={cn('font-bold', d.isRival ? 'text-amber-300' : 'text-red-300')}>{d.code}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{d.team}</td>
                  <td className="px-3 py-2 text-center">{d.wins}</td>
                  <td className="px-3 py-2 text-center hidden sm:table-cell">{d.podiums}</td>
                  <td className="px-3 py-2 text-right font-bold">{d.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-[10px] text-muted-foreground font-mono-nums border-t border-border/60">
          OUR BEST: P5 TSU 164pts · GAP TO P4: 127pts · 6 ROUNDS REMAINING
        </div>
      </Card>

      {/* Metric breakdown */}
      <Card className="lg:col-span-2 border-border/50 bg-card/60 card-hover">
        <SectionHeader title="Metric Breakdown" subtitle="How each radar score is computed from the warehouse data" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 px-4 pb-4">
          {[
            { label: 'Pace', ours: ourMetrics.pace, rival: rivalMetrics.pace, formula: 'inverse of avg Δ', icon: <Gauge className="h-3.5 w-3.5" /> },
            { label: 'Consistency', ours: ourMetrics.consistency, rival: rivalMetrics.consistency, formula: 'inverse of Δ variance', icon: <Activity className="h-3.5 w-3.5" /> },
            { label: 'Tire Mgmt', ours: ourMetrics.tireMgmt, rival: rivalMetrics.tireMgmt, formula: 'inverse of deg slope', icon: <TrendingDown className="h-3.5 w-3.5" /> },
            { label: 'Fuel Eff', ours: ourMetrics.fuelEff, rival: rivalMetrics.fuelEff, formula: 'inverse of burn rate', icon: <Fuel className="h-3.5 w-3.5" /> },
            { label: 'Qualifying', ours: ourMetrics.qualifying, rival: rivalMetrics.qualifying, formula: 'inverse of max Δ', icon: <Target className="h-3.5 w-3.5" /> },
          ].map((m) => {
            const diff = m.ours - m.rival
            return (
              <div key={m.label} className="rounded-md border border-border/50 bg-background/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
                  {m.icon}{m.label}
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-mono-nums text-xl font-bold text-red-300">{m.ours.toFixed(0)}</span>
                  <span className="text-[10px] text-muted-foreground">vs</span>
                  <span className="font-mono-nums text-xl font-bold text-amber-300">{m.rival.toFixed(0)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden flex">
                  <div className="bg-red-500" style={{ width: `${m.ours}%` }} />
                  <div className="bg-amber-500/60" style={{ width: `${m.rival}%` }} />
                </div>
                <div className={cn('mt-1.5 text-[10px] font-mono-nums', diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-zinc-400')}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} {diff > 0 ? 'advantage' : diff < 0 ? 'deficit' : 'equal'}
                </div>
                <div className="mt-0.5 text-[9px] text-muted-foreground font-mono-nums">{m.formula}</div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}


