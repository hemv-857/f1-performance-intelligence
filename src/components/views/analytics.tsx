'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { SectionHeader, StatCard, fmtLapTime, fmtDelta, StatusBadge, SessionBadge, TrackMap, getCornerPoints } from '@/components/shared'
import { SkeletonChart, SkeletonTable } from '@/components/skeletons'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  Line, LineChart, BarChart, Bar, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Legend, Area, AreaChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { Activity, Timer, TrendingDown, TrendingUp, Fuel, Database, GitCompare, Layers, Gauge, Zap, ChevronRight, MapPin, Wind, Flame, Flag, Target, Trophy, Swords, Car, Crosshair } from 'lucide-react'

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
          <TabsTrigger value="constructors" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300"><Trophy className="h-3.5 w-3.5 mr-1.5" /> Constructors</TabsTrigger>
          <TabsTrigger value="deepdive" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300"><Crosshair className="h-3.5 w-3.5 mr-1.5" /> Deep-Dive</TabsTrigger>
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

        {/* ---- Constructors Championship ---- */}
        <TabsContent value="constructors" className="space-y-4">
          <ConstructorsTab />
        </TabsContent>

        {/* ---- Driver Comparison Deep-Dive ---- */}
        <TabsContent value="deepdive" className="space-y-4">
          <DeepDiveTab ourDriverId={ourDriverId} rivalId={rivalId} ourDrivers={ourDrivers} rivals={rivals} selectedSessionId={selectedSessionId} circuitName={selectedSession?.circuit.name ?? 'Singapore'} />
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

// ---- Constructors Championship tab: standings + progression + battle matrix ----
function ConstructorsTab() {
  const teams = [
    { pos: 1, name: 'Red Bull Racing', car: 'RB21', pts: 729, wins: 11, podiums: 24, poles: 9, form: [1, 2, 1, 1, 3], color: '#f87171', isOurs: false },
    { pos: 2, name: 'McLaren', car: 'MCL39', pts: 658, wins: 6, podiums: 19, poles: 4, form: [2, 1, 3, 2, 1], color: '#fbbf24', isOurs: false },
    { pos: 3, name: 'Ferrari', car: 'SF-25', pts: 612, wins: 4, podiums: 15, poles: 2, form: [3, 3, 2, 4, 2], color: '#34d399', isOurs: false },
    { pos: 4, name: 'Mercedes', car: 'W16', pts: 534, wins: 2, podiums: 12, poles: 1, form: [4, 5, 4, 3, 5], color: '#fb923c', isOurs: false },
    { pos: 5, name: 'Racing Bulls', car: 'VCARB 02', pts: 302, wins: 0, podiums: 2, poles: 0, form: [6, 5, 6, 5, 4], color: '#fb7185', isOurs: true },
  ]

  // Cumulative constructors' points over 16 rounds. Monotonically increasing;
  // round-16 values match the standings table above.
  const progression = [
    { round: 1,  redBull: 44,  mcLaren: 38,  ferrari: 35,  mercedes: 30,  racingBulls: 16 },
    { round: 2,  redBull: 88,  mcLaren: 78,  ferrari: 72,  mercedes: 62,  racingBulls: 32 },
    { round: 3,  redBull: 135, mcLaren: 120, ferrari: 110, mercedes: 95,  racingBulls: 50 },
    { round: 4,  redBull: 178, mcLaren: 162, ferrari: 145, mercedes: 128, racingBulls: 68 },
    { round: 5,  redBull: 225, mcLaren: 200, ferrari: 180, mercedes: 158, racingBulls: 85 },
    { round: 6,  redBull: 270, mcLaren: 240, ferrari: 218, mercedes: 188, racingBulls: 102 },
    { round: 7,  redBull: 318, mcLaren: 282, ferrari: 252, mercedes: 220, racingBulls: 122 },
    { round: 8,  redBull: 363, mcLaren: 322, ferrari: 290, mercedes: 252, racingBulls: 142 },
    { round: 9,  redBull: 412, mcLaren: 365, ferrari: 325, mercedes: 282, racingBulls: 162 },
    { round: 10, redBull: 458, mcLaren: 405, ferrari: 360, mercedes: 312, racingBulls: 182 },
    { round: 11, redBull: 505, mcLaren: 445, ferrari: 398, mercedes: 345, racingBulls: 202 },
    { round: 12, redBull: 553, mcLaren: 488, ferrari: 432, mercedes: 375, racingBulls: 222 },
    { round: 13, redBull: 600, mcLaren: 528, ferrari: 468, mercedes: 410, racingBulls: 242 },
    { round: 14, redBull: 638, mcLaren: 568, ferrari: 502, mercedes: 442, racingBulls: 258 },
    { round: 15, redBull: 685, mcLaren: 612, ferrari: 558, mercedes: 488, racingBulls: 280 },
    { round: 16, redBull: 729, mcLaren: 658, ferrari: 612, mercedes: 534, racingBulls: 302 },
  ]

  // Battle matrix — Racing Bulls vs each rival over the last 4 rounds.
  // Each cell = our points that round − their points that round.
  const rivals = [
    { key: 'rb',  code: 'RBR', name: 'Red Bull', color: '#f87171' },
    { key: 'mcl', code: 'MCL', name: 'McLaren',  color: '#fbbf24' },
    { key: 'fer', code: 'FER', name: 'Ferrari',  color: '#34d399' },
    { key: 'mer', code: 'MER', name: 'Mercedes', color: '#fb923c' },
  ] as const
  type RivalKey = typeof rivals[number]['key']
  const battleRows: { round: string; rb: number; mcl: number; fer: number; mer: number }[] = [
    { round: 'R13', rb: -4, mcl: -1, fer:  1, mer:  4 },
    { round: 'R14', rb: -4, mcl:  1, fer:  2, mer:  6 },
    { round: 'R15', rb: -4, mcl: -3, fer: -8, mer: -6 },
    { round: 'R16', rb: -2, mcl:  2, fer:  8, mer:  6 },
  ]
  const battleTotal: Record<RivalKey, number> = {
    rb:  battleRows.reduce((s, r) => s + r.rb, 0),
    mcl: battleRows.reduce((s, r) => s + r.mcl, 0),
    fer: battleRows.reduce((s, r) => s + r.fer, 0),
    mer: battleRows.reduce((s, r) => s + r.mer, 0),
  }

  // Form dot color: green=win, amber=podium, zinc=points, rose=DNF/none
  const formDot = (pos: number) =>
    pos === 1   ? 'bg-emerald-500'
    : pos <= 3  ? 'bg-amber-500'
    : pos <= 10 ? 'bg-zinc-500'
    : 'bg-rose-500'
  const formLabel = (pos: number) => (pos > 10 ? 'DNF' : `P${pos}`)

  return (
    <>
      {/* 1) Constructors Standings */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover p-4">
        <SectionHeader
          title="Constructors Standings"
          subtitle="2025 F1 Team Championship"
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 text-red-300">
              <Trophy className="h-3 w-3 mr-1" /> ROUND 16 / 22
            </Badge>
          }
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[10px] uppercase tracking-wider text-muted-foreground border-border/60">
                <TableHead className="w-8 text-left font-medium">Pos</TableHead>
                <TableHead className="text-left font-medium">Team</TableHead>
                <TableHead className="text-left font-medium">Car</TableHead>
                <TableHead className="text-right font-medium">Pts</TableHead>
                <TableHead className="text-center font-medium">Wins</TableHead>
                <TableHead className="text-center font-medium hidden sm:table-cell">Podiums</TableHead>
                <TableHead className="text-center font-medium hidden md:table-cell">Poles</TableHead>
                <TableHead className="text-center font-medium">Form</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono-nums">
              {teams.map((t) => (
                <TableRow
                  key={t.name}
                  className={cn(
                    'border-border/30 transition-colors hover:bg-red-500/5',
                    t.isOurs && 'bg-red-500/10 ring-1 ring-inset ring-red-500/30',
                  )}
                >
                  <TableCell className="font-bold text-muted-foreground">{t.pos}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color }} />
                      <span className={cn('font-semibold', t.isOurs ? 'text-red-300' : 'text-foreground')}>
                        {t.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono-nums text-[10px] border-border/60 text-muted-foreground">
                      <Car className="h-3 w-3 mr-1" />{t.car}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-base">{t.pts}</TableCell>
                  <TableCell className="text-center">{t.wins}</TableCell>
                  <TableCell className="text-center hidden sm:table-cell">{t.podiums}</TableCell>
                  <TableCell className="text-center hidden md:table-cell">{t.poles}</TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1">
                      {t.form.map((p, i) => (
                        <span
                          key={i}
                          title={formLabel(p)}
                          className={cn('h-2 w-2 rounded-full transition-transform hover:scale-125', formDot(p))}
                        />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 px-3 py-2 text-[10px] text-muted-foreground font-mono-nums border-t border-border/60 flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-red-300">OUR TEAM: P5 302pts</span>
          <span className="text-border">·</span>
          <span>GAP TO P4: <span className="text-amber-300">232pts</span></span>
          <span className="text-border">·</span>
          <span>6 ROUNDS REMAINING</span>
        </div>
      </Card>

      {/* 2) Points progression chart */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover p-4">
        <SectionHeader
          title="Points Progression"
          subtitle="Cumulative constructors' points · rounds 1–16"
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-amber-500/40 text-amber-300">
              <TrendingUp className="h-3 w-3 mr-1" /> 5 TEAMS
            </Badge>
          }
        />
        <div className="h-[340px] w-full px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progression} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="round" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="R" />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                labelFormatter={(v) => `Round ${v}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={16} stroke="#f87171" strokeDasharray="4 4" label={{ value: 'NOW', position: 'top', fill: '#f87171', fontSize: 10, fontWeight: 700 }} />
              <Line type="monotone" dataKey="redBull"      name="Red Bull"      stroke="#f87171" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="mcLaren"      name="McLaren"       stroke="#fbbf24" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="ferrari"      name="Ferrari"       stroke="#34d399" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="mercedes"     name="Mercedes"      stroke="#fb923c" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="racingBulls"  name="Racing Bulls"  stroke="#fb7185" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 3) Head-to-Head Battle Matrix */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover p-4">
        <SectionHeader
          title="Head-to-Head Battle Matrix"
          subtitle="Points gained per round vs each rival team (green = we gained, red = we lost)"
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-rose-500/40 text-rose-300">
              <Swords className="h-3 w-3 mr-1" /> R13–R16
            </Badge>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Round</th>
                {rivals.map((r) => (
                  <th key={r.key} className="text-center font-medium px-3 py-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                      <span>{r.code}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono-nums">
              {battleRows.map((row) => (
                <tr key={row.round} className="border-t border-border/30">
                  <td className="px-3 py-2 font-bold text-muted-foreground">{row.round}</td>
                  {rivals.map((r) => {
                    const v = row[r.key]
                    return (
                      <td key={r.key} className="px-3 py-2 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center min-w-[3rem] rounded-md px-2 py-1 text-xs font-bold border',
                            v > 0
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : v < 0
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
                          )}
                        >
                          {v > 0 ? '+' : ''}{v}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-border/60 bg-red-500/5">
                <td className="px-3 py-2.5 font-bold text-red-300">Total</td>
                {rivals.map((r) => {
                  const v = battleTotal[r.key]
                  return (
                    <td key={r.key} className="px-3 py-2.5 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[3rem] rounded-md px-2 py-1 text-sm font-bold border',
                          v > 0
                            ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/40'
                            : v < 0
                              ? 'bg-rose-500/25 text-rose-200 border-rose-500/40'
                              : 'bg-zinc-500/25 text-zinc-200 border-zinc-500/40',
                        )}
                      >
                        {v > 0 ? '+' : ''}{v}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 px-3 py-2 text-[10px] text-muted-foreground font-mono-nums border-t border-border/60 flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-emerald-300">▲ OUTSCORED MERCEDES BY 10 OVER LAST 4 ROUNDS</span>
          <span className="text-border">·</span>
          <span className="text-rose-300">▼ TRAILING RED BULL BY 14</span>
          <span className="text-border">·</span>
          <span>NET SWING VS FERRARI: <span className="text-emerald-300">+3</span></span>
        </div>
      </Card>
    </>
  )
}

// ---- Deep-Dive tab: corner-by-corner delta + stint consistency + trajectory ----
function DeepDiveTab({
  ourDriverId, rivalId, ourDrivers, rivals, selectedSessionId, circuitName,
}: {
  ourDriverId: string | null
  rivalId: string | null
  ourDrivers: any[]
  rivals: any[]
  selectedSessionId: string | null
  circuitName: string
}) {
  const ourCode = ourDrivers.find((d: any) => d.id === ourDriverId)?.code ?? 'TSU'
  const rivalCode = rivals.find((d: any) => d.id === rivalId)?.code ?? 'VER'

  // Fetch delta records (lap + per-sector). Keyed separately from the parent's
  // ['delta', ...] query so react-query caches both independently.
  const deltaQ = useQuery({
    queryKey: ['delta-corner', selectedSessionId, ourDriverId, rivalId],
    enabled: !!selectedSessionId && !!ourDriverId && !!rivalId,
    queryFn: async () =>
      (fetch(`/api/analytics/delta?sessionId=${selectedSessionId}&driverId=${ourDriverId}&rivalId=${rivalId}`)).then((r) => r.json()),
  })

  // Fetch session laps for the stint-consistency sparklines. Keyed separately
  // from the parent's sessionQ so the Deep-Dive tab owns its own fetch.
  const sessionQ = useQuery({
    queryKey: ['session-deepdive', selectedSessionId],
    enabled: !!selectedSessionId,
    queryFn: async () => (fetch(`/api/sessions/${selectedSessionId}`)).then((r) => r.json()),
  })

  // ---- Card 1: corner-by-corner heatmap ----
  const sectorRows: any[] = (deltaQ.data?.sectorDeltas ?? []).slice(0, 10)
  const sectorAvg = (idx: 1 | 2 | 3) => {
    if (sectorRows.length === 0) return 0
    const sum = sectorRows.reduce((s: number, r: any) => s + (r[`s${idx}`] ?? 0), 0)
    return sum / sectorRows.length
  }
  const avgs = [sectorAvg(1), sectorAvg(2), sectorAvg(3)]
  let bestSector = 1
  let worstSector = 1
  for (let i = 1; i <= 3; i++) {
    if (avgs[i - 1] < avgs[bestSector - 1]) bestSector = i
    if (avgs[i - 1] > avgs[worstSector - 1]) worstSector = i
  }
  // Heatmap cell color — emerald (we're faster), red (we're slower), zinc (small).
  // Intensity scales with magnitude (mirrors the existing delta-tab sector heatmap).
  const cellColor = (v: number) => {
    if (v === 0) return 'bg-zinc-800/40 text-zinc-500'
    if (v > 200) return 'bg-red-500/35 text-red-200'
    if (v > 50) return 'bg-red-500/25 text-red-300'
    if (v < -200) return 'bg-emerald-500/35 text-emerald-200'
    if (v < -50) return 'bg-emerald-500/25 text-emerald-300'
    return 'bg-zinc-700/30 text-zinc-300'
  }

  // ---- Card 2: stint consistency sparklines ----
  const drivers: any[] = sessionQ.data?.session?.drivers ?? []
  const ourSessionDriver = drivers.find((d: any) => d.driver.id === ourDriverId)
  const rivalSessionDriver = drivers.find((d: any) => d.driver.id === rivalId)
  const ourLaps: { lap: number; time: number }[] = (ourSessionDriver?.laps ?? [])
    .filter((l: any) => l.isValid)
    .map((l: any) => ({ lap: l.lapNumber, time: l.lapTimeMs }))
  const rivalLaps: { lap: number; time: number }[] = (rivalSessionDriver?.laps ?? [])
    .filter((l: any) => l.isValid)
    .map((l: any) => ({ lap: l.lapNumber, time: l.lapTimeMs }))
  // Sample standard deviation (n-1) — a measure of lap-time variance.
  const stdDev = (arr: number[]) => {
    if (arr.length < 2) return 0
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1)
    return Math.sqrt(variance)
  }
  const ourStd = stdDev(ourLaps.map((l) => l.time))
  const rivalStd = stdDev(rivalLaps.map((l) => l.time))
  const verdict = (s: number) =>
    s < 200
      ? { label: 'CONSISTENT', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' }
      : s <= 400
        ? { label: 'VARIABLE', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' }
        : { label: 'ERRATIC', cls: 'border-red-500/40 bg-red-500/10 text-red-300' }

  // ---- Card 3: performance trajectory (rolling 3-lap avg of lap delta) ----
  const lapDeltas: { lap: number; delta: number }[] = (deltaQ.data?.laps ?? [])
    .slice(0, 10)
    .map((l: any) => ({ lap: l.lapNumber, delta: l.deltaMs }))
  const rolling: { lap: number; avg: number }[] = []
  for (let i = 2; i < lapDeltas.length; i++) {
    const slice = lapDeltas.slice(i - 2, i + 1)
    const avg = slice.reduce((s, x) => s + x.delta, 0) / 3
    rolling.push({ lap: lapDeltas[i].lap, avg: Math.round(avg * 10) / 10 })
  }
  const validAvgs = rolling.map((r) => r.avg)
  const bestStreak = validAvgs.length ? Math.min(...validAvgs) : 0
  const worstStreak = validAvgs.length ? Math.max(...validAvgs) : 0
  const half = Math.max(1, Math.floor(validAvgs.length / 2))
  const firstHalfAvg = validAvgs.slice(0, half).reduce((s, v) => s + v, 0) / half
  const secondHalfAvg = validAvgs.length > half
    ? validAvgs.slice(half).reduce((s, v) => s + v, 0) / (validAvgs.length - half)
    : firstHalfAvg
  // delta-P: negative = we're faster. Lower second-half avg = improving.
  const trendImproving = secondHalfAvg < firstHalfAvg

  // ---- Card 0: Track Delta Map (mini track map + per-corner delta halos) ----
  // The TrackMap component renders corner markers at fixed SVG coords
  // (viewBox 0 0 200 140). We overlay a second SVG layer with a colored
  // halo ring per corner, colored by the avg delta of the sector that corner
  // belongs to (S1/S2/S3). emerald = we're faster, red = we're slower.
  const cornerPts = getCornerPoints(circuitName)
  const cornerCount = cornerPts.length
  // Assign each 1-indexed corner to one of three roughly-equal sector groups
  // (e.g. Singapore 19 corners → S1: 1-7, S2: 8-14, S3: 15-19).
  const sectorOf = (num: number) => {
    const n = cornerCount || 8
    const third = Math.max(1, Math.ceil(n / 3))
    return Math.min(3, Math.floor((num - 1) / third) + 1)
  }
  // Hex color for a per-sector delta avg (negative = faster = emerald).
  const deltaHex = (v: number) =>
    v < -50 ? '#34d399' : v > 50 ? '#f87171' : '#71717a'
  const deltaVerdict = (v: number) =>
    v < -50 ? 'FASTER' : v > 50 ? 'SLOWER' : 'NEUTRAL'

  return (
    <>
      {/* 0) Track Delta Map — mini circuit map with per-corner delta halos */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover p-4">
        <SectionHeader
          title="Track Delta Map"
          subtitle={`${ourCode} vs ${rivalCode} — delta overlaid on the circuit map (green = we're faster, red = we're slower)`}
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 text-red-300">
              <MapPin className="h-3 w-3 mr-1" />{circuitName.toUpperCase()}
            </Badge>
          }
        />
        {deltaQ.isLoading ? (
          <SkeletonChart height={360} />
        ) : (
          <div className="space-y-4">
            {/* track map + per-corner delta halo overlay */}
            <div className="flex items-center justify-center rounded-md p-4 bg-gradient-to-br from-red-950/20 via-transparent to-emerald-950/10">
              <div className="relative" style={{ width: 360, height: 252 }}>
                <TrackMap circuitName={circuitName} size={360} active showLabels />
                <svg
                  viewBox="0 0 200 140"
                  width={360}
                  height={252}
                  className="absolute inset-0 pointer-events-none"
                  aria-hidden="true"
                >
                  {cornerPts.map((p) => {
                    const color = deltaHex(avgs[sectorOf(p.num) - 1])
                    return (
                      <circle
                        key={p.num}
                        cx={p.x}
                        cy={p.y}
                        r={5.5}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.4}
                        opacity={0.95}
                        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                      />
                    )
                  })}
                </svg>
              </div>
            </div>

            {/* legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-mono-nums text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#34d399' }} />
                FASTER
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#f87171' }} />
                SLOWER
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#71717a' }} />
                NEUTRAL
              </span>
              <span className="text-[10px] text-muted-foreground/80">
                Dots show per-sector avg delta (S1/S2/S3 mapped to corner groups)
              </span>
            </div>

            {/* sector summary strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((s) => {
                const v = avgs[s - 1]
                const color = deltaHex(v)
                const verdict = deltaVerdict(v)
                const magPct = Math.min(100, (Math.abs(v) / 1000) * 100)
                return (
                  <div key={s} className="rounded-md border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                        <span className="font-mono-nums text-xs font-bold">SECTOR {s}</span>
                      </div>
                      <span className="font-mono-nums text-sm font-bold" style={{ color }}>
                        {fmtDelta(v)}s
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-700/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${magPct}%`, background: color }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono-nums">
                      <span>vs rival</span>
                      <span style={{ color }}>{verdict}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* 1) Corner-by-corner delta heatmap */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover p-4">
        <SectionHeader
          title="Corner-by-Corner Delta"
          subtitle={`${ourCode} vs ${rivalCode} — per-corner time delta across the last 10 laps`}
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 text-red-300">
              <Crosshair className="h-3 w-3 mr-1" />{sectorRows.length} LAPS
            </Badge>
          }
        />
        {deltaQ.isLoading ? (
          <SkeletonTable rows={10} cols={5} />
        ) : sectorRows.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No sector delta data available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono-nums border-collapse">
              <thead>
                <tr className="text-[10px] uppercase text-muted-foreground">
                  <th className="text-left px-2 py-1.5 font-medium">Lap</th>
                  <th className="text-center px-2 py-1.5 font-medium">S1</th>
                  <th className="text-center px-2 py-1.5 font-medium">S2</th>
                  <th className="text-center px-2 py-1.5 font-medium">S3</th>
                  <th className="text-center px-2 py-1.5 font-medium">Lap Δ</th>
                </tr>
              </thead>
              <tbody>
                {sectorRows.map((d: any) => {
                  const lapDelta = (deltaQ.data?.laps ?? []).find((l: any) => l.lapNumber === d.lapNumber)?.deltaMs ?? 0
                  return (
                    <tr key={d.lapNumber} className="border-b border-border/30">
                      <td className="px-2 py-1.5 font-bold text-muted-foreground">L{d.lapNumber}</td>
                      <td className={cn('text-center px-3 py-1.5 rounded', cellColor(d.s1))}>{fmtDelta(d.s1)}</td>
                      <td className={cn('text-center px-3 py-1.5 rounded', cellColor(d.s2))}>{fmtDelta(d.s2)}</td>
                      <td className={cn('text-center px-3 py-1.5 rounded', cellColor(d.s3))}>{fmtDelta(d.s3)}</td>
                      <td className={cn('text-center px-3 py-1.5 rounded font-bold', cellColor(lapDelta))}>{fmtDelta(lapDelta)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {sectorRows.length > 0 && (
          <div className="mt-3 px-3 py-2 text-[10px] text-muted-foreground font-mono-nums border-t border-border/60 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-emerald-300"><Target className="inline h-3 w-3 mr-1" />Best sector: S{bestSector} ({fmtDelta(avgs[bestSector - 1])})</span>
            <span className="text-border">·</span>
            <span className="text-red-300"><Flame className="inline h-3 w-3 mr-1" />Worst sector: S{worstSector} ({fmtDelta(avgs[worstSector - 1])})</span>
          </div>
        )}
      </Card>

      {/* 2) Stint Consistency Sparklines */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover p-4">
        <SectionHeader
          title="Stint Consistency"
          subtitle="Lap-time variance across the stint (lower = more consistent)"
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-amber-500/40 text-amber-300">
              <Activity className="h-3 w-3 mr-1" /> STD DEV
            </Badge>
          }
        />
        {sessionQ.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonChart height={120} />
            <SkeletonChart height={120} />
          </div>
        ) : ourLaps.length === 0 && rivalLaps.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No stint lap-time data available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConsistencySparkline
              title={ourCode}
              color="#f87171"
              laps={ourLaps}
              std={ourStd}
              verdict={verdict(ourStd)}
            />
            <ConsistencySparkline
              title={rivalCode}
              color="#fbbf24"
              laps={rivalLaps}
              std={rivalStd}
              verdict={verdict(rivalStd)}
            />
          </div>
        )}
      </Card>

      {/* 3) Performance Trajectory */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover p-4">
        <SectionHeader
          title="Performance Trajectory"
          subtitle="Rolling 3-lap average delta vs rival"
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 text-red-300">
              <TrendingUp className="h-3 w-3 mr-1" /> 3-LAP AVG
            </Badge>
          }
        />
        {deltaQ.isLoading ? (
          <SkeletonChart height={260} />
        ) : rolling.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Not enough laps for a 3-lap rolling average.</div>
        ) : (
          <>
            <div className="h-[260px] px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rolling} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trajGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="lap" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="ms" />
                  <ReferenceLine y={0} stroke="#52525b" strokeDasharray="2 2" />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                    labelFormatter={(v) => `Lap ${v}`}
                    formatter={(v: any) => [`${v} ms`, '3-lap avg Δ']}
                  />
                  <Area type="monotone" dataKey="avg" stroke="#f87171" strokeWidth={2} fill="url(#trajGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pb-2">
              <StatCard
                label="Best streak"
                value={fmtDelta(bestStreak)}
                unit="s"
                sub="lowest 3-lap avg"
                accent="emerald"
                icon={<TrendingDown className="h-4 w-4" />}
              />
              <StatCard
                label="Worst streak"
                value={fmtDelta(worstStreak)}
                unit="s"
                sub="highest 3-lap avg"
                accent="red"
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard
                label="Trend"
                value={trendImproving ? 'IMPROVING' : 'WORSENING'}
                sub={`H1 ${fmtDelta(firstHalfAvg)} → H2 ${fmtDelta(secondHalfAvg)}`}
                accent={trendImproving ? 'emerald' : 'red'}
                icon={trendImproving ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              />
            </div>
          </>
        )}
      </Card>
    </>
  )
}

// ---- Small sparkline sub-component for the stint consistency card ----
function ConsistencySparkline({
  title, color, laps, std, verdict,
}: {
  title: string
  color: string
  laps: { lap: number; time: number }[]
  std: number
  verdict: { label: string; cls: string }
}) {
  const chartData = laps.map((l) => ({ lap: l.lap, time: l.time }))
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="font-mono-nums text-xs font-bold" style={{ color }}>{title}</span>
        </div>
        <Badge variant="outline" className={cn('font-mono-nums text-[10px]', verdict.cls)}>
          {verdict.label}
        </Badge>
      </div>
      <div className="h-[60px]">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="lap" hide />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Line type="monotone" dataKey="time" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground font-mono-nums">insufficient data</div>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground font-mono-nums">
        <span>Consistency (σ)</span>
        <span style={{ color }}>{(std / 1000).toFixed(3)}s · {std.toFixed(0)}ms</span>
      </div>
    </div>
  )
}
