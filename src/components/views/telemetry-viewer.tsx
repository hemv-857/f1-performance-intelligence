'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket'
import { useAppStore, logAudit } from '@/lib/store'
import { SectionHeader, fmtLapTime, fmtDelta, StatusBadge, channelColor, TrackMap } from '@/components/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Tooltip as UITooltip, TooltipTrigger as UITooltipTrigger, TooltipContent as UITooltipContent, TooltipProvider as UITooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceArea, ReferenceLine, ComposedChart, Area,
} from 'recharts'
import { Download, Layers, GitCompare, Gauge, Radio, AlertCircle, Activity, Zap, Loader2, Play, Pause, Rewind, SkipBack, SkipForward, FastForward } from 'lucide-react'

const CHANNEL_GROUPS = [
  { group: 'engine', label: 'Engine & Drivetrain', channels: ['speed', 'throttle', 'brake', 'gear', 'rpm'] },
  { group: 'aero', label: 'Aero & Tire Temps', channels: ['tire_fl_temp', 'tire_fr_temp', 'tire_rl_temp', 'tire_rr_temp', 'drs'] },
  { group: 'suspension', label: 'Suspension', channels: ['suspension_fl', 'suspension_fr'] },
  { group: 'power_unit', label: 'Power Unit', channels: ['boost_pressure', 'fuel_flow'] },
]

export function TelemetryViewer({ socket }: { socket: ReturnType<typeof useTelemetrySocket> }) {
  const { sessions, selectedSessionId, setSelectedSessionId } = useAppStore()
  const [mode, setMode] = useState<'live' | 'overlay' | 'playback'>('live')
  const [activeChannel, setActiveChannel] = useState('speed')
  const [group, setGroup] = useState('engine')
  const [compareChannel, setCompareChannel] = useState('tire_fl_temp')
  const [exporting, setExporting] = useState(false)

  const handleExportPdf = async () => {
    if (!selectedSessionId) return
    setExporting(true)
    try {
      const res = await fetch(`/api/reports/pdf/${selectedSessionId}?driverId=${lapAOverride ?? ''}&rivalId=${lapBOverride ?? ''}&channel=${compareChannel}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `RB-Report-${sessions.find((s) => s.id === selectedSessionId)?.type ?? 'session'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      const sessionLabel = sessions.find((s) => s.id === selectedSessionId)?.type ?? 'session'
      logAudit(
        'pdf_export',
        'telemetry',
        'engineer',
        selectedSessionId,
        `PDF report exported · ${sessionLabel}`,
        'info',
        { sizeKb: Math.round(blob.size / 1024) },
      )
    } catch (e) {
      console.error('PDF export failed', e)
    } finally {
      setExporting(false)
    }
  }

  // session detail — always fetch when a session is selected (used by overlay mode)
  const sessionQ = useQuery({
    queryKey: ['session', selectedSessionId],
    enabled: !!selectedSessionId,
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async () => (fetch(`/api/sessions/${selectedSessionId}`)).then((r) => r.json()),
  })

  // For overlay: pick our fastest lap + rival fastest lap
  const ourDriver = sessionQ.data?.session.drivers.find((d: any) => !d.driver.isRival)
  const rivalDriver = sessionQ.data?.session.drivers.find((d: any) => d.driver.isRival)
  const ourFastest = ourDriver?.laps.find((l: any) => l.isFastest) ?? ourDriver?.laps[0]
  const rivalFastest = rivalDriver?.laps.find((l: any) => l.isFastest) ?? rivalDriver?.laps[0]

  // user overrides (null until the engineer picks a lap manually); otherwise default to fastest laps
  const [lapAOverride, setLapAOverride] = useState<string | null>(null)
  const [lapBOverride, setLapBOverride] = useState<string | null>(null)
  const lapAId = lapAOverride ?? ourFastest?.id ?? null
  const lapBId = lapBOverride ?? rivalFastest?.id ?? null

  const compareQ = useQuery({
    queryKey: ['compare', lapAId, lapBId, compareChannel],
    enabled: !!lapAId && !!lapBId && mode === 'overlay',
    queryFn: async () =>
      (fetch(`/api/telemetry/compare?lapA=${lapAId}&lapB=${lapBId}&channel=${compareChannel}`)).then((r) => r.json()),
  })

  const liveTicks = socket.ticks

  // Push anomalies to the global store (so the AI Engineer panel can auto-ask)
  const { pushAnomaly } = useAppStore()
  useEffect(() => {
    if (mode !== 'live') return
    const allChannels = CHANNEL_GROUPS.flatMap((g) => g.channels)
    for (const c of allChannels) {
      const v = liveTicks['TSU']?.channels[c]
      if (v != null && isAnomaly(c, v)) {
        const range = getChannelRange(c)
        pushAnomaly({
          channel: c,
          driverCode: 'TSU',
          value: v,
          range: range ?? { min: 0, max: 0 },
          message: `${c.replace(/_/g, ' ')} on TSU is ${v.toFixed(c.includes('temp') || c.includes('pressure') ? 1 : 0)} — outside safe range ${range ? `[${range.min}, ${range.max}]` : ''}`,
        })
      }
    }
  }, [liveTicks, mode, pushAnomaly])

  // Manually inject an anomaly (for demo/testing the AI auto-trigger)
  const simulateAnomaly = () => {
    // pick a random channel to spike
    const channels = ['tire_fl_temp', 'tire_fr_temp', 'boost_pressure', 'fuel_flow', 'rpm']
    const ch = channels[Math.floor(Math.random() * channels.length)]
    const range = getChannelRange(ch)
    // generate an out-of-range value
    const value = ch.startsWith('tire_') ? 118 + Math.random() * 4 : ch === 'boost_pressure' ? 3.9 + Math.random() * 0.2 : ch === 'fuel_flow' ? 107 + Math.random() * 3 : 12600 + Math.random() * 400
    pushAnomaly({
      channel: ch,
      driverCode: 'TSU',
      value,
      range: range ?? { min: 0, max: 0 },
      message: `SIMULATED: ${ch.replace(/_/g, ' ')} on TSU spiked to ${value.toFixed(ch.includes('temp') || ch.includes('pressure') ? 1 : 0)} — outside safe range ${range ? `[${range.min}, ${range.max}]` : ''}`,
    })
  }

  const liveSeries = useMemo(() => {
    const codes = socket.drivers.map((d) => d.code)
    const n = 60
    // build rolling buffer from latest ticks (just current snapshot repeated for demo visual)
    return Array.from({ length: n }, (_, i) => {
      const point: any = { i }
      for (const code of codes) {
        const t = liveTicks[code]
        if (t) point[code] = t.channels[activeChannel] ?? 0
      }
      return point
    })
  }, [liveTicks, activeChannel, socket.drivers])

  // lap overlay compare series
  const compareSeries = useMemo(() => {
    if (!compareQ.data) return []
    const n = Math.min(compareQ.data.traceA.length, compareQ.data.traceB.length)
    return Array.from({ length: n }, (_, i) => ({
      distance: compareQ.data.traceA[i].distance,
      [compareQ.data.lapA.driver.code]: compareQ.data.traceA[i].value,
      [compareQ.data.lapB.driver.code]: compareQ.data.traceB[i].value,
      diff: compareQ.data.diff[i].delta,
    }))
  }, [compareQ.data])

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <Card className="border-border/50 bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border/60 overflow-hidden">
              <button
                onClick={() => setMode('live')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === 'live' ? 'bg-red-500/15 text-red-300' : 'text-muted-foreground hover:text-foreground')}
              >
                <Radio className="h-3.5 w-3.5" /> Live Channels
              </button>
              <button
                onClick={() => setMode('overlay')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-border/60',
                  mode === 'overlay' ? 'bg-red-500/15 text-red-300' : 'text-muted-foreground hover:text-foreground')}
              >
                <GitCompare className="h-3.5 w-3.5" /> Lap Overlay & Diff
              </button>
              <button
                onClick={() => setMode('playback')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-border/60',
                  mode === 'playback' ? 'bg-red-500/15 text-red-300' : 'text-muted-foreground hover:text-foreground')}
              >
                <Rewind className="h-3.5 w-3.5" /> Playback
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedSessionId ?? ''} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.filter((s) => s.status !== 'scheduled').map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    R{s.round} · {s.circuit.name} · {s.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === 'overlay' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-red-500/40 text-red-300 hover:bg-red-500/10"
                disabled={!selectedSessionId || exporting}
                onClick={handleExportPdf}
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                {exporting ? 'Generating…' : 'Export PDF'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {mode === 'live' && (
        <>
          {/* channel group selector */}
          <Card className="border-border/50 bg-card/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {CHANNEL_GROUPS.map((g) => (
                <button
                  key={g.group}
                  onClick={() => { setGroup(g.group); setActiveChannel(g.channels[0]) }}
                  className={cn('flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors',
                    group === g.group ? 'border-red-500/50 bg-red-500/10 text-red-300' : 'border-border/60 text-muted-foreground hover:text-foreground')}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: channelColor(g.group) }} />
                  {g.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
              {CHANNEL_GROUPS.find((g) => g.group === group)!.channels.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveChannel(c)}
                  className={cn('rounded px-2 py-1 text-[11px] font-mono-nums transition-colors',
                    activeChannel === c ? 'bg-foreground text-background font-bold' : 'bg-muted text-muted-foreground hover:text-foreground')}
                >
                  {c}
                </button>
              ))}
            </div>
          </Card>

          {/* live multi-driver chart */}
          <Card className="border-border/50 bg-card/60 card-hover">
            <SectionHeader
              title={`Live ${activeChannel} — all drivers`}
              subtitle="10 Hz push from Spark streaming · 1 kHz source (downsampled for web)"
              right={
                <div className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 rounded-full', socket.connected ? 'bg-emerald-400 blink' : 'bg-red-500')} />
                  <span className="text-[10px] font-mono-nums text-muted-foreground">{socket.connected ? 'STREAMING' : 'OFFLINE'}</span>
                </div>
              }
            />
            <div className="h-[340px] px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={liveSeries} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="liveFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="i" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                  />
                  {socket.drivers.map((d) => (
                    <Line
                      key={d.code}
                      type="monotone"
                      dataKey={d.code}
                      stroke={d.isRival ? '#fbbf24' : d.code === 'TSU' ? '#f87171' : '#fb923c'}
                      strokeWidth={d.isRival ? 1.5 : 2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 px-3 pb-3 text-[11px] font-mono-nums">
              {socket.drivers.map((d) => {
                const t = liveTicks[d.code]
                const v = t?.channels[activeChannel]
                return (
                  <div key={d.code} className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', d.isRival ? 'bg-amber-400' : d.code === 'TSU' ? 'bg-red-500' : 'bg-orange-400')} />
                    <span className="font-bold">{d.code}</span>
                    <span className="text-muted-foreground">{v != null ? v.toFixed(1) : '—'}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* live numeric channels grid — with anomaly detection */}
          <Card className="border-border/50 bg-card/60 p-3">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-xs font-medium flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                <span>Live channel anomaly detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] border-red-500/40 text-red-300 hover:bg-red-500/10"
                  onClick={simulateAnomaly}
                >
                  <Zap className="h-3 w-3 mr-1" /> Simulate anomaly
                </Button>
                <span className="text-[10px] text-muted-foreground font-mono-nums">
                  {(() => {
                    const anomalies = CHANNEL_GROUPS.flatMap((g) => g.channels).slice(0, 12).filter((c) => {
                      const v = liveTicks['TSU']?.channels[c]
                      return v != null && isAnomaly(c, v)
                    })
                    return anomalies.length === 0
                      ? '✓ ALL CHANNELS NOMINAL'
                      : `${anomalies.length} ANOMALY${anomalies.length > 1 ? 'S' : ''} DETECTED`
                  })()}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {CHANNEL_GROUPS.flatMap((g) => g.channels).slice(0, 12).map((c) => {
                const tsu = liveTicks['TSU']?.channels[c]
                const ver = liveTicks['VER']?.channels[c]
                const delta = tsu != null && ver != null ? tsu - ver : 0
                const anomalous = tsu != null && isAnomaly(c, tsu)
                const range = getChannelRange(c)
                return (
                  <Card
                    key={c}
                    className={cn(
                      'border p-3 transition-all relative overflow-hidden',
                      anomalous
                        ? 'border-red-500/60 bg-red-500/10 pulse-red'
                        : 'border-border/50 bg-card/60 card-hover'
                    )}
                  >
                    {anomalous && (
                      <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 blink" />
                    )}
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums truncate">
                      {c.replace(/_/g, ' ')}
                    </div>
                    <div className={cn(
                      'mt-1 font-mono-nums text-xl font-bold',
                      anomalous ? 'text-red-300 text-glow' : 'text-foreground'
                    )}>
                      {tsu != null ? tsu.toFixed(c.includes('temp') || c.includes('pressure') || c.includes('flow') ? 1 : 0) : '—'}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground font-mono-nums flex items-center justify-between">
                      <span>TSU</span>
                      <span className={cn(
                        Math.abs(delta) < 1 ? 'text-zinc-400' : delta > 0 ? 'text-red-400' : 'text-emerald-400'
                      )}>
                        Δ{delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                      </span>
                    </div>
                    {range && (
                      <div className="mt-1.5 h-0.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={cn('h-full transition-all', anomalous ? 'bg-red-500' : 'bg-emerald-500/60')}
                          style={{ width: `${Math.min(100, Math.max(0, ((tsu ?? range.min) - range.min) / (range.max - range.min) * 100))}%` }}
                        />
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </Card>
        </>
      )}
      {mode === 'overlay' && (
        <>
          {/* Lap picker + compare channel */}
          <Card className="border-border/50 bg-card/60 p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Our lap (A)</label>
                <LapPicker drivers={sessionQ.data?.session.drivers} value={lapAId} onChange={setLapAOverride} ours />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Rival lap (B)</label>
                <LapPicker drivers={sessionQ.data?.session.drivers} value={lapBId} onChange={setLapBOverride} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Compare channel</label>
                <Select value={compareChannel} onValueChange={setCompareChannel}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNEL_GROUPS.flatMap((g) => g.channels).map((c) => (
                      <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* overlay chart */}
          <Card className="border-border/50 bg-card/60 card-hover">
            <SectionHeader
              title="Lap Trace Overlay"
              subtitle={
                compareQ.data
                  ? `${compareQ.data.lapA.driver.code} ${fmtLapTime(compareQ.data.lapA.lapTimeMs)} vs ${compareQ.data.lapB.driver.code} ${fmtLapTime(compareQ.data.lapB.lapTimeMs)} — ${compareQ.data.channel.label}`
                  : 'Loading…'
              }
              right={
                compareQ.data && (
                  <Badge variant="outline" className="font-mono-nums text-[10px] border-amber-500/40 text-amber-300">
                    Δ {fmtDelta(compareQ.data.lapA.lapTimeMs - compareQ.data.lapB.lapTimeMs)}s
                  </Badge>
                )
              }
            />
            <div className="h-[340px] px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={compareSeries} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="distance" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="m" />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                    labelFormatter={(v) => `${v} m`}
                    formatter={(v: any, name) => [`${v}`, name]}
                  />
                  {compareQ.data && (
                    <>
                      <Line type="monotone" dataKey={compareQ.data.lapA.driver.code} stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey={compareQ.data.lapB.driver.code} stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </>
                  )}
                  {/* highlight problem zones */}
                  {compareQ.data?.zones.map((z: any, i: number) => (
                    <ReferenceArea key={i} x1={z.distance - 800} x2={z.distance + 800} fill="#ef4444" fillOpacity={0.08} stroke="#ef4444" strokeOpacity={0.2} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="px-3 pb-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-red-500/30" /> Problem zones (largest Δ)</span>
            </div>
          </Card>

          {/* Why is our brake temp higher? */}
          {compareQ.data && (
            <Card className="border-red-500/30 bg-red-950/10">
              <SectionHeader title="Channel Diff Diagnosis" subtitle={`Top problem zones for ${compareQ.data.channel.label}`} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  {compareQ.data.zones.map((z: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                          Math.abs(z.delta) > 5 ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300')}>{i + 1}</span>
                        <div>
                          <div className="text-xs font-mono-nums">@{z.distance}m</div>
                          <div className="text-[10px] text-muted-foreground">~{((z.distance / (compareQ.data.traceA.length * (compareQ.data.traceA[compareQ.data.traceA.length - 1]?.distance ?? 1))) * 100).toFixed(0)}% lap</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn('font-mono-nums font-bold', z.delta > 0 ? 'text-red-400' : 'text-emerald-400')}>
                          {z.delta > 0 ? '+' : ''}{z.delta.toFixed(1)} {compareQ.data.channel.unit}
                        </div>
                        <div className="text-[10px] text-muted-foreground">A vs B</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-border/50 bg-background/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-semibold">Auto-generated insight</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {generateInsight(compareQ.data)}
                  </p>
                  <div className="mt-3 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                    Recommended action: cross-reference aero diff &amp; suspension travel at the flagged distance bins, then export a chassis sensitivity report.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Sector splits */}
          {sessionQ.data && ourDriver && rivalDriver && (
            <Card className="border-border/50 bg-card/60 card-hover">
              <SectionHeader title="Sector Splits — best laps" subtitle={`${ourDriver.driver.code} vs ${rivalDriver.driver.code}`} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
                {[1, 2, 3].map((sec) => {
                  const oS = sec === 1 ? ourFastest?.sector1Ms : sec === 2 ? ourFastest?.sector2Ms : ourFastest?.sector3Ms
                  const rS = sec === 1 ? rivalFastest?.sector1Ms : sec === 2 ? rivalFastest?.sector2Ms : rivalFastest?.sector3Ms
                  const d = (oS ?? 0) - (rS ?? 0)
                  return (
                    <div key={sec} className="rounded-lg border border-border/50 bg-background/40 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Sector {sec}</div>
                      <div className="mt-1 font-mono-nums text-lg font-bold">{fmtLapTime(oS ?? 0)}</div>
                      <div className="mt-1 flex items-center justify-between text-xs font-mono-nums">
                        <span className="text-muted-foreground">vs {rivalDriver.driver.code}</span>
                        <span className={cn(d > 0 ? 'text-red-400' : 'text-emerald-400')}>{d > 0 ? '+' : ''}{fmtDelta(d)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
      {mode === 'playback' && <PlaybackMode sessionId={selectedSessionId} />}
    </div>
  )
}

// ============ Playback Mode (feat-3 — frame-by-frame lap scrubber) ============

const PLAYBACK_CHANNELS = [
  'speed', 'throttle', 'brake', 'gear', 'rpm',
  'tire_fl_temp', 'tire_fr_temp', 'tire_rl_temp', 'tire_rr_temp',
  'suspension_fl', 'boost_pressure', 'fuel_flow',
] as const

const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const

function PlaybackMode({ sessionId }: { sessionId: string | null }) {
  // session detail (drivers + laps) — needed to populate the lap picker
  const sessionQ = useQuery({
    queryKey: ['session', sessionId],
    enabled: !!sessionId,
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async () => (await fetch(`/api/sessions/${sessionId}`)).json(),
  })

  const ourDrivers: any[] = (sessionQ.data?.session.drivers ?? []).filter((d: any) => !d.driver.isRival)

  // Build lap options for ALL our drivers' laps (TSU + LAW).
  // Each option label: "TSU L9 1:43.34 S ★" (driver code, lap number, lap time, compound letter, star if fastest).
  const lapOptions: { id: string; label: string; isFastest: boolean; lapTimeMs: number }[] = ourDrivers.flatMap((d: any) =>
    (d.laps ?? []).map((l: any) => ({
      id: l.id,
      label: `${d.driver.code} L${l.lapNumber} ${fmtLapTime(l.lapTimeMs)} ${(l.tireCompound ?? 'M').slice(0, 1).toUpperCase()}${l.isFastest ? ' ★' : ''}`,
      isFastest: !!l.isFastest,
      lapTimeMs: l.lapTimeMs,
    }))
  )

  // Default to the absolute fastest lap among our drivers.
  const fastestOpt = lapOptions.length > 0
    ? lapOptions.slice().sort((a, b) => a.lapTimeMs - b.lapTimeMs)[0]
    : null
  const fastestId = fastestOpt?.id ?? null
  const validIds = new Set(lapOptions.map((o) => o.id))

  const [selectedLapId, setSelectedLapId] = useState<string | null>(null)
  // Render-time state adjustment (allowed by react-hooks/set-state-in-render):
  // if no lap selected yet, or the previously-selected lap is no longer in the
  // current session's lap list (e.g. user switched sessions), default to fastest.
  if (fastestId && (selectedLapId === null || !validIds.has(selectedLapId))) {
    setSelectedLapId(fastestId)
  }

  // Lap telemetry fetch — returns { lap, channels: { [key]: { data: [{distance, value, t}] } } }
  const lapQ = useQuery({
    queryKey: ['lap-telemetry', selectedLapId],
    enabled: !!selectedLapId,
    staleTime: 0,
    queryFn: async () => (await fetch(`/api/telemetry/lap/${selectedLapId}`)).json(),
  })

  const lap = lapQ.data?.lap
  const channels: Record<string, { key: string; label: string; unit: string; group: string; data: { distance: number; value: number; t: number }[] }> = lapQ.data?.channels ?? {}
  // circuit.trackLength is stored in km in the seed; convert to meters for display.
  const trackLengthKm = lap?.circuit?.trackLength ?? 0
  const trackLengthM = Math.round(trackLengthKm * 1000)
  const lapTimeMs = lap?.lapTimeMs ?? 0

  // Scrubber state.
  const [scrubPos, setScrubPos] = useState(0) // 0..100
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  // Render-time adjustment: when selectedLapId changes, reset scrub + pause.
  const [prevLapId, setPrevLapId] = useState<string | null>(selectedLapId)
  if (selectedLapId !== prevLapId) {
    setPrevLapId(selectedLapId)
    setScrubPos(0)
    setPlaying(false)
  }

  // Auto-advance playback via setInterval (setState inside setInterval callback
  // is allowed by react-hooks/set-state-in-effect — see devops.tsx CountdownCard).
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setScrubPos((prev) => {
        const next = prev + speed * 0.5 // %/tick
        return next >= 100 ? 0 : next // loop back to start
      })
    }, 100)
    return () => clearInterval(id)
  }, [playing, speed])

  // Reference max distance from speed channel (all channels share the same distance grid in the seed).
  const speedData = channels.speed?.data ?? []
  const maxDist = speedData.length > 0 ? speedData[speedData.length - 1].distance : 0
  const targetDistance = (scrubPos / 100) * maxDist
  const distanceMeters = (scrubPos / 100) * trackLengthM
  const elapsedMs = (scrubPos / 100) * lapTimeMs

  // Sector determination (S1/S2/S3 boundaries from lap sectors, fallback to thirds).
  const s1 = lap?.sector1Ms ?? lapTimeMs / 3
  const s2 = lap?.sector2Ms ?? lapTimeMs / 3
  const s3 = lap?.sector3Ms ?? lapTimeMs / 3
  let currentSector = 1
  if (elapsedMs > s1) currentSector = 2
  if (elapsedMs > s1 + s2) currentSector = 3

  // Multi-channel trace series for the playhead chart (speed + brake + throttle).
  // Scale the raw telemetry distance to true circuit meters so the chart X-axis
  // matches the "Distance: ... / ... m" display and the ReferenceLine playhead aligns.
  const distScale = maxDist > 0 ? trackLengthM / maxDist : 1
  const traceData = useMemo(() => {
    const sp = channels.speed?.data ?? []
    const br = channels.brake?.data ?? []
    const th = channels.throttle?.data ?? []
    return sp.map((p, i) => ({
      distance: Math.round(p.distance * distScale),
      speed: p.value,
      brake: br[i]?.value ?? 0,
      throttle: th[i]?.value ?? 0,
    }))
  }, [channels, distScale])

  // ---- Loading / empty states ----
  if (!sessionId) {
    return (
      <Card className="border-border/50 bg-card/60 p-6 text-sm text-muted-foreground">
        Select a session above to begin lap playback.
      </Card>
    )
  }
  if (sessionQ.isLoading) {
    return (
      <Card className="border-border/50 bg-card/60 p-6 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading session…
      </Card>
    )
  }
  if (lapQ.isLoading) {
    return (
      <Card className="border-border/50 bg-card/60 p-6 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading lap telemetry…
      </Card>
    )
  }
  if (!lap) {
    return (
      <Card className="border-border/50 bg-card/60 p-6 text-sm text-muted-foreground">
        No lap selected — pick a lap below.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 1) Lap selector */}
      <Card className="border-border/50 bg-card/60 backdrop-blur p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Lap to replay</label>
            <Select value={selectedLapId ?? ''} onValueChange={(v) => setSelectedLapId(v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select lap" /></SelectTrigger>
              <SelectContent>
                {lapOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Circuit</div>
            <div className="font-mono-nums text-sm text-foreground mt-1">{lap.circuit.name} · {trackLengthM.toLocaleString()} m</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Driver</div>
            <div className="font-mono-nums text-sm text-foreground mt-1">
              <span className="text-red-300 font-bold mr-1">{lap.driver.code}</span>
              {lap.driver.name}
            </div>
          </div>
        </div>
      </Card>

      {/* 2) Scrubber centerpiece */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover p-4">
        <SectionHeader
          title="Lap Playback Scrubber"
          subtitle={`Replay ${lap.driver.code} L${lap.lapNumber} · ${fmtLapTime(lapTimeMs)}${lap.isFastest ? ' · fastest lap' : ''}`}
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 text-red-300">
              <Rewind className="h-3 w-3 mr-1" /> frame-by-frame
            </Badge>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
          {/* left column: position + slider + transport + sectors */}
          <div className="space-y-4">
            {/* big position display */}
            <div className="flex items-baseline gap-5 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Distance</div>
                <div className="font-mono-nums text-2xl font-bold text-foreground">
                  {Math.round(distanceMeters).toLocaleString()}
                  <span className="text-sm text-muted-foreground ml-1">/ {trackLengthM.toLocaleString()} m</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Lap time</div>
                <div className="font-mono-nums text-2xl font-bold text-foreground">
                  {fmtLapTime(elapsedMs)}
                  <span className="text-sm text-muted-foreground ml-1">/ {fmtLapTime(lapTimeMs)}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Progress</div>
                <div className="font-mono-nums text-2xl font-bold text-red-300">
                  {scrubPos.toFixed(1)}
                  <span className="text-sm text-muted-foreground ml-1">%</span>
                </div>
              </div>
            </div>

            {/* the slider — prominent h-2 track, red thumb */}
            <Slider
              value={[scrubPos]}
              onValueChange={(v) => setScrubPos(v[0])}
              max={100}
              step={0.5}
              aria-label="Lap progress scrubber"
              className="[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-range]]:bg-red-500 [&_[data-slot=slider-thumb]]:h-5 [&_[data-slot=slider-thumb]]:w-5 [&_[data-slot=slider-thumb]]:border-red-500 [&_[data-slot=slider-thumb]]:bg-red-500 [&_[data-slot=slider-thumb]]:shadow-[0_0_10px_rgba(248,113,113,0.7)]"
            />

            {/* transport controls: skip back / play-pause / skip fwd + speed control */}
            <div className="flex flex-wrap items-center gap-2">
              <UITooltipProvider delayDuration={200}>
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-border/60 bg-card/40" onClick={() => setScrubPos(0)}>
                      <SkipBack className="h-4 w-4" />
                    </Button>
                  </UITooltipTrigger>
                  <UITooltipContent>Restart lap</UITooltipContent>
                </UITooltip>
              </UITooltipProvider>

              <UITooltipProvider delayDuration={200}>
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="h-10 w-10 p-0 border-red-500/50 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      onClick={() => setPlaying(!playing)}
                      aria-label={playing ? 'Pause' : 'Play'}
                    >
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </UITooltipTrigger>
                  <UITooltipContent>{playing ? 'Pause playback' : 'Play playback'}</UITooltipContent>
                </UITooltip>
              </UITooltipProvider>

              <UITooltipProvider delayDuration={200}>
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-border/60 bg-card/40" onClick={() => setScrubPos(100)}>
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </UITooltipTrigger>
                  <UITooltipContent>Jump to finish</UITooltipContent>
                </UITooltip>
              </UITooltipProvider>

              <div className="h-6 w-px bg-border/40 mx-1" />

              {/* speed control */}
              <div className="flex items-center gap-1">
                <FastForward className="h-3 w-3 text-muted-foreground mr-1" />
                {PLAYBACK_SPEEDS.map((s) => (
                  <Button
                    key={s}
                    variant={speed === s ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'h-8 px-2 text-xs font-mono-nums',
                      speed === s
                        ? 'border-red-500/50 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                        : 'border-border/60 bg-card/40 text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setSpeed(s)}
                    aria-label={`Playback speed ${s}x`}
                  >
                    {s}x
                  </Button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono-nums">
                <Gauge className="h-3.5 w-3.5" />
                <span>{playing ? `playing @ ${speed}x` : 'paused'}</span>
              </div>
            </div>

            {/* sector indicators */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((sec) => {
                const secMs = sec === 1 ? s1 : sec === 2 ? s2 : s3
                const active = currentSector === sec
                return (
                  <div
                    key={sec}
                    className={cn(
                      'rounded-md border px-3 py-2 transition-colors',
                      active
                        ? 'border-red-500/60 bg-red-500/15 text-red-300'
                        : 'border-border/50 bg-background/40 text-muted-foreground'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-mono-nums">Sector {sec}</span>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-red-500 blink" />}
                    </div>
                    <div className="mt-0.5 font-mono-nums text-sm font-bold">{fmtLapTime(secMs ?? 0)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* right column: track map */}
          <div className="flex flex-col items-center justify-center bg-background/40 rounded-md border border-border/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums mb-2 self-start">Track position</div>
            <TrackMap circuitName={lap.circuit.name} size={180} active progress={scrubPos / 100} />
            <div className="mt-3 text-xs font-mono-nums text-muted-foreground text-center">
              {Math.round(distanceMeters).toLocaleString()}m / {trackLengthM.toLocaleString()}m
            </div>
          </div>
        </div>
      </Card>

      {/* 3) Live channel readouts at current scrub position */}
      <Card className="border-border/50 bg-card/60 backdrop-blur p-4">
        <SectionHeader
          title="Channel Readouts"
          subtitle="Values interpolated at the current scrub position · sparkline shows full-lap trace"
          right={
            <Badge variant="outline" className="font-mono-nums text-[10px] border-amber-500/40 text-amber-300">
              {PLAYBACK_CHANNELS.length} channels
            </Badge>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {PLAYBACK_CHANNELS.map((key) => {
            const ch = channels[key]
            const data = ch?.data ?? []
            const value = interpValue(data, targetDistance)
            const group = ch?.group ?? guessGroup(key)
            const color = groupColorHex(group)
            const unit = ch?.unit ?? ''
            return (
              <Card key={key} className="border-border/50 bg-card/60 card-hover p-3 relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(to right, transparent, ${color}99, transparent)` }}
                />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums truncate">
                  {key.replace(/_/g, ' ')}
                </div>
                <div className="mt-1 font-mono-nums text-xl font-bold" style={{ color }}>
                  {value != null ? formatChannelValue(key, value) : '—'}
                  {unit && <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span>}
                </div>
                <div className="mt-1">
                  <ChannelSparkline data={data.map((d) => d.value)} color={color} scrubPos={scrubPos} />
                </div>
              </Card>
            )
          })}
        </div>
      </Card>

      {/* 4) Multi-channel trace chart with playhead */}
      <Card className="border-border/50 bg-card/60 backdrop-blur card-hover">
        <SectionHeader
          title="Full-Lap Trace"
          subtitle="Speed (red line) · Brake (amber area) · Throttle (emerald line) — playhead at current scrub position"
          right={
            <div className="flex items-center gap-3 text-[10px] font-mono-nums">
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-red-500" /> speed</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-amber-400" /> brake</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-emerald-400" /> throttle</span>
            </div>
          }
        />
        <div className="h-[320px] px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={traceData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="brakeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="distance" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} unit="m" />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                labelFormatter={(v) => `${v} m`}
              />
              <Area yAxisId="right" dataKey="brake" stroke="#fbbf24" strokeWidth={1.5} fill="url(#brakeFill)" dot={false} isAnimationActive={false} />
              <Line yAxisId="right" dataKey="throttle" type="monotone" stroke="#34d399" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line yAxisId="left" dataKey="speed" type="monotone" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceLine yAxisId="left" x={Math.round(distanceMeters)} stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

// ---- PlaybackMode helpers ----

// Linear interpolation: given a sorted-by-distance telemetry sample array,
// find the 2 nearest samples around `distance` and lerp the value.
function interpValue(
  data: { distance: number; value: number }[],
  distance: number,
): number | null {
  if (!data || data.length === 0) return null
  if (distance <= data[0].distance) return data[0].value
  if (distance >= data[data.length - 1].distance) return data[data.length - 1].value
  let lo = 0
  let hi = data.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (data[mid].distance <= distance) lo = mid
    else hi = mid
  }
  const a = data[lo]
  const b = data[hi]
  const range = b.distance - a.distance
  const f = range === 0 ? 0 : (distance - a.distance) / range
  return a.value + (b.value - a.value) * f
}

// Group → hex color (spec: engine=orange, brakes=red, aero=emerald, suspension=amber, power_unit=rose).
function groupColorHex(group: string): string {
  const m: Record<string, string> = {
    engine: '#fb923c',
    brakes: '#f87171',
    aero: '#34d399',
    suspension: '#fbbf24',
    power_unit: '#fb7185',
  }
  return m[group] ?? '#a1a1aa'
}

// Fallback group guesser (used when channel metadata is missing from the API response).
function guessGroup(key: string): string {
  if (key === 'brake') return 'brakes'
  if (key.startsWith('tire_')) return 'aero'
  if (key.startsWith('suspension_')) return 'suspension'
  if (key === 'boost_pressure' || key === 'fuel_flow') return 'power_unit'
  return 'engine'
}

// Format a channel value for display — depends on the channel type.
function formatChannelValue(key: string, value: number): string {
  if (key === 'gear') return value.toFixed(0)
  if (key === 'rpm') return Math.round(value).toLocaleString()
  if (key === 'speed') return value.toFixed(0)
  if (key === 'throttle' || key === 'brake') return value.toFixed(0)
  if (key.startsWith('suspension_')) return (value >= 0 ? '+' : '') + value.toFixed(1)
  return value.toFixed(1)
}

// Lightweight inline SVG sparkline — full-lap trace with a vertical red line at the scrub position.
function ChannelSparkline({
  data,
  color,
  scrubPos,
}: {
  data: number[]
  color: string
  scrubPos: number
}) {
  if (!data || data.length < 2) return <div className="h-6" />
  const w = 100
  const h = 24
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const n = data.length - 1
  const pts = data
    .map((v, i) => `${((i / n) * w).toFixed(2)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(2)}`)
    .join(' ')
  const scrubX = (scrubPos / 100) * w
  const scrubIdx = Math.min(n, Math.max(0, Math.round((scrubPos / 100) * n)))
  const scrubY = h - ((data[scrubIdx] - min) / range) * (h - 4) - 2
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-6 block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <line
        x1={scrubX}
        y1={0}
        x2={scrubX}
        y2={h}
        stroke="#f87171"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={scrubX} cy={scrubY} r={1.6} fill="#f87171" />
    </svg>
  )
}

function LapPicker({ drivers, value, onChange, ours }: { drivers: any[]; value: string | null; onChange: (id: string) => void; ours?: boolean }) {
  const opts = drivers ?? []
  const relevant = ours ? opts.filter((d) => !d.driver.isRival) : opts.filter((d) => d.driver.isRival)
  const laps = relevant[0]?.laps ?? []
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select lap" /></SelectTrigger>
      <SelectContent>
        {laps.map((l: any) => (
          <SelectItem key={l.id} value={l.id}>
            L{l.lapNumber} · {fmtLapTime(l.lapTimeMs)} {l.tireCompound?.slice(0, 1).toUpperCase()}{l.isFastest ? ' ★' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function generateInsight(data: any) {
  const topZone = data.zones[0]
  const driver = data.lapA.driver.code
  const rival = data.lapB.driver.code
  const ch = data.channel.label
  const unit = data.channel.unit
  const delta = topZone.delta.toFixed(1)
  const sign = topZone.delta > 0 ? 'higher' : 'lower'
  const cause = data.channel.group === 'brakes' ? 'aero duct airflow or brake-bias setup' : data.channel.group === 'aero' ? 'tire thermal balance / corner entry speed' : data.channel.group === 'suspension' ? 'ride height or bump-rebound mapping' : 'power-unit mapping'
  return `At ~${topZone.distance}m, ${driver}'s ${ch} is ${delta} ${unit} ${sign} than ${rival}'s. Across the top problem zones this pattern repeats at braking/apex bins — investigate ${cause}.`
}

// ---- Anomaly detection helpers ----
const CHANNEL_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  speed: { min: 0, max: 340, unit: 'km/h' },
  throttle: { min: 0, max: 100, unit: '%' },
  brake: { min: 0, max: 100, unit: '%' },
  gear: { min: 1, max: 8, unit: '' },
  rpm: { min: 0, max: 13000, unit: 'rpm' },
  tire_fl_temp: { min: 80, max: 120, unit: '°C' },
  tire_fr_temp: { min: 80, max: 120, unit: '°C' },
  tire_rl_temp: { min: 80, max: 120, unit: '°C' },
  tire_rr_temp: { min: 80, max: 120, unit: '°C' },
  suspension_fl: { min: -50, max: 50, unit: 'mm' },
  suspension_fr: { min: -50, max: 50, unit: 'mm' },
  boost_pressure: { min: 0, max: 4, unit: 'bar' },
  fuel_flow: { min: 0, max: 110, unit: 'kg/h' },
  drs: { min: 0, max: 1, unit: '' },
}

function getChannelRange(key: string): { min: number; max: number; unit: string } | null {
  return CHANNEL_RANGES[key] ?? null
}

function isAnomaly(key: string, value: number): boolean {
  const r = CHANNEL_RANGES[key]
  if (!r) return false
  // Tire temps: anomaly if outside 80-120 (above 115 = critical, below 75 = cold)
  if (key.startsWith('tire_')) return value > 115 || value < 75
  // Brake temp proxy: if brake pressure > 95% sustained, flag
  if (key === 'brake') return value > 98
  // RPM redline
  if (key === 'rpm') return value > 12500
  // Boost pressure over-boost
  if (key === 'boost_pressure') return value > 3.8
  // Fuel flow over limit (110 kg/h FIA limit)
  if (key === 'fuel_flow') return value > 105
  // Suspension travel extreme
  if (key.startsWith('suspension_')) return Math.abs(value) > 40
  return false
}
