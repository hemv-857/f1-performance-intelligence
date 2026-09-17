'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket'
import { useAppStore } from '@/lib/store'
import { SectionHeader, fmtLapTime, fmtDelta, StatusBadge, channelColor } from '@/components/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceArea, ReferenceLine, ComposedChart, Area,
} from 'recharts'
import { Download, Layers, GitCompare, Gauge, Radio, AlertCircle, Activity, Zap, Loader2 } from 'lucide-react'

const CHANNEL_GROUPS = [
  { group: 'engine', label: 'Engine & Drivetrain', channels: ['speed', 'throttle', 'brake', 'gear', 'rpm'] },
  { group: 'aero', label: 'Aero & Tire Temps', channels: ['tire_fl_temp', 'tire_fr_temp', 'tire_rl_temp', 'tire_rr_temp', 'drs'] },
  { group: 'suspension', label: 'Suspension', channels: ['suspension_fl', 'suspension_fr'] },
  { group: 'power_unit', label: 'Power Unit', channels: ['boost_pressure', 'fuel_flow'] },
]

export function TelemetryViewer({ socket }: { socket: ReturnType<typeof useTelemetrySocket> }) {
  const { sessions, selectedSessionId, setSelectedSessionId } = useAppStore()
  const [mode, setMode] = useState<'live' | 'overlay'>('live')
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
                className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === 'overlay' ? 'bg-red-500/15 text-red-300' : 'text-muted-foreground hover:text-foreground')}
              >
                <GitCompare className="h-3.5 w-3.5" /> Lap Overlay & Diff
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

      {mode === 'live' ? (
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

          {/* live numeric channels grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CHANNEL_GROUPS.flatMap((g) => g.channels).slice(0, 12).map((c) => {
              const tsu = liveTicks['TSU']?.channels[c]
              const ver = liveTicks['VER']?.channels[c]
              const delta = tsu != null && ver != null ? tsu - ver : 0
              return (
                <Card key={c} className="border-border/50 bg-card/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums truncate">{c.replace(/_/g, ' ')}</div>
                  <div className="mt-1 font-mono-nums text-xl font-bold text-foreground">
                    {tsu != null ? tsu.toFixed(c.includes('temp') || c.includes('pressure') || c.includes('flow') ? 1 : 0) : '—'}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground font-mono-nums flex items-center justify-between">
                    <span>TSU</span>
                    <span className={cn(Math.abs(delta) < 1 ? 'text-zinc-400' : delta > 0 ? 'text-red-400' : 'text-emerald-400')}>
                      Δ{delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      ) : (
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
    </div>
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
