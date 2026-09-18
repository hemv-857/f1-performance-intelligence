'use client'

import { Fragment, useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Boxes,
  Plus,
  Star,
  Play,
  X,
  Code2,
  Database,
  Gauge as GaugeIcon,
  LineChart as LineIcon,
  BarChart3,
  Grid3x3,
  Save,
  CalendarClock,
  Loader2,
  Activity,
} from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SessionSummary } from '@/lib/types'

// ---------- Types ----------

type ChartType = 'line' | 'bar' | 'heatmap' | 'track3d' | 'gauge'

interface Template {
  id: string
  name: string
  owner: string
  discipline: string
  querySql: string
  chartType: ChartType
  params: Record<string, string>
  schedule: string | null
  isFavorite: boolean
  lastRunAt: string | null
  createdAt: string
}

interface DriverOption {
  id: string
  code: string
  name: string
  team: string
  number: number
  isRival: boolean
}

interface LinePoint {
  x: number
  y: number
}

interface Track3DPoint {
  distance: number
  speed: number
  throttle: number
  brake: number
}

type RunResult =
  | { type: 'line'; data: LinePoint[]; meta?: { label?: string } }
  | { type: 'bar'; data: LinePoint[]; meta?: { label?: string } }
  | { type: 'heatmap'; rows: string[]; cols: string[]; matrix: number[][] }
  | { type: 'track3d'; trace: Track3DPoint[] }
  | { type: 'gauge'; value: number; max: number; label?: string }

interface RunResponse {
  result: RunResult
  executedSql: string
  params: Record<string, string>
  queryLatencyMs: number
  rowsAffected: number
  ranAt: string
}

interface Widget {
  uid: string
  template: Template
  params: Record<string, string>
  result?: RunResult
  executedSql?: string
  latencyMs?: number
  rowsAffected?: number
  ranAt?: string
  running?: boolean
  error?: string
}

// ---------- Helpers ----------

const RED = '#f87171'
const AMBER = '#fbbf24'
const EMERALD = '#34d399'
const ORANGE = '#fb923c'
const ROSE = '#fb7185'

function chartIcon(type: ChartType, className?: string) {
  const cls = className ?? 'h-4 w-4'
  switch (type) {
    case 'line':
      return <LineIcon className={cls} />
    case 'bar':
      return <BarChart3 className={cls} />
    case 'heatmap':
      return <Grid3x3 className={cls} />
    case 'track3d':
      return <Boxes className={cls} />
    case 'gauge':
      return <GaugeIcon className={cls} />
  }
}

function hexToRgb(h: string): [number, number, number] {
  const m = h.replace('#', '')
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t)
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t)
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

// ---------- Palette card ----------

function PaletteCard({
  template,
  onAdd,
  onToggleFav,
}: {
  template: Template
  onAdd: (t: Template) => void
  onToggleFav: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${template.id}`,
    data: { kind: 'palette', template },
  })
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        zIndex: 50,
      }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onAdd(template)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAdd(template)
        }
      }}
      className="group cursor-grab active:cursor-grabbing rounded-lg border border-border/50 bg-card/60 p-3 hover:border-red-500/40 hover:bg-card/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-red-400">{chartIcon(template.chartType, 'h-3.5 w-3.5')}</span>
            <span className="text-sm font-medium truncate">{template.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-border/60 text-muted-foreground">
              {template.discipline}
            </Badge>
            <span className="text-[9px] font-mono-nums text-muted-foreground">{template.chartType}</span>
            {template.schedule && (
              <span className="text-[9px] font-mono-nums text-amber-300/80 flex items-center gap-0.5">
                <CalendarClock className="h-2.5 w-2.5" />
                {template.schedule}
              </span>
            )}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleFav(template.id)
              }}
              className="shrink-0 rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              aria-label={template.isFavorite ? 'Unfavorite template' : 'Favorite template'}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  template.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground group-hover:text-amber-300/80',
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>{template.isFavorite ? 'Unfavorite' : 'Mark favorite'}</TooltipContent>
        </Tooltip>
      </div>
      <pre className="mt-2 text-[10px] font-mono-nums text-muted-foreground line-clamp-2 whitespace-pre-wrap break-all bg-background/40 rounded p-1.5 border border-border/30">
        {template.querySql.slice(0, 60) || '— no SQL —'}
      </pre>
      <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono-nums text-muted-foreground">
        <span>by {template.owner}</span>
        {template.lastRunAt ? (
          <span className="text-emerald-300/70">last {new Date(template.lastRunAt).toLocaleDateString()}</span>
        ) : (
          <span>never run</span>
        )}
      </div>
    </div>
  )
}

// ---------- Param input ----------

function ParamInput({
  name,
  type,
  value,
  drivers,
  sessions,
  onChange,
}: {
  name: string
  type: string
  value: string
  drivers: DriverOption[]
  sessions: SessionSummary[]
  onChange: (v: string) => void
}) {
  if (name === 'session_id') {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
          {name} <span className="text-muted-foreground/60">: {type}</span>
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue placeholder="select session" />
          </SelectTrigger>
          <SelectContent>
            {sessions.length === 0 && <SelectItem value="">no sessions</SelectItem>}
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                R{s.round} · {s.type} · {s.circuit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  if (name === 'driver_id') {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
          {name} <span className="text-muted-foreground/60">: {type}</span>
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue placeholder="select driver" />
          </SelectTrigger>
          <SelectContent>
            {drivers.length === 0 && <SelectItem value="">no drivers</SelectItem>}
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.code} · {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
        {name} <span className="text-muted-foreground/60">: {type}</span>
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs font-mono-nums"
        placeholder={type === 'int' ? '0' : 'value'}
        inputMode={type === 'int' ? 'numeric' : 'text'}
      />
    </div>
  )
}

// ---------- Result visualisations ----------

function ResultViz({ result }: { result: RunResult }) {
  switch (result.type) {
    case 'line':
      return (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <RTooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v: number) => [`${v}`, result.meta?.label ?? 'y']}
              />
              <Line dataKey="y" stroke={RED} strokeWidth={2} dot={false} isAnimationActive={false} name={result.meta?.label ?? 'y'} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )
    case 'bar':
      return (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result.data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <RTooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                cursor={{ fill: 'rgba(251, 130, 50, 0.08)' }}
                formatter={(v: number) => [`${v}`, result.meta?.label ?? 'y']}
              />
              <Bar dataKey="y" fill={ORANGE} radius={[3, 3, 0, 0]} isAnimationActive={false} name={result.meta?.label ?? 'y'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    case 'heatmap':
      return <Heatmap result={result} />
    case 'track3d':
      return <Track3D result={result} />
    case 'gauge':
      return <GaugeViz result={result} />
    default:
      return null
  }
}

function Heatmap({ result }: { result: Extract<RunResult, { type: 'heatmap' }> }) {
  const { rows, cols, matrix } = result
  const min = 90
  const max = 115
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-0.5 min-w-full" style={{ gridTemplateColumns: `70px repeat(${cols.length}, minmax(28px, 1fr))` }}>
        <div />
        {cols.map((c) => (
          <div key={c} className="text-[9px] font-mono-nums text-muted-foreground text-center pb-0.5 truncate">{c}</div>
        ))}
        {rows.map((rowName, r) => (
          <Fragment key={rowName}>
            <div className="text-[9px] font-mono-nums text-muted-foreground pr-1 truncate flex items-center">{rowName}</div>
            {matrix[r]?.map((v, c) => {
              const t = Math.max(0, Math.min(1, (v - min) / (max - min)))
              const bg = lerpColor('#3f3f46', RED, t)
              return (
                <div
                  key={`${r}-${c}`}
                  className="h-6 rounded-sm flex items-center justify-center text-[9px] font-mono-nums"
                  style={{ backgroundColor: bg, color: t > 0.55 ? '#18181b' : '#e4e4e7' }}
                  title={`${rowName} · ${cols[c]} = ${v}`}
                >
                  {v}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[9px] font-mono-nums text-muted-foreground">
        <span>{min}</span>
        <div className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, #3f3f46, ${RED})` }} />
        <span>{max}</span>
      </div>
    </div>
  )
}

function Track3D({ result }: { result: Extract<RunResult, { type: 'track3d' }> }) {
  const trace = result.trace
  const n = trace.length
  const speeds = useMemo(() => trace.map((p) => p.speed), [trace])
  const minS = speeds.length ? Math.min(...speeds) : 0
  const maxS = speeds.length ? Math.max(...speeds) : 0
  const pts = useMemo(() => {
    const cx = 110
    const cy = 70
    const rx = 95
    const ry = 55
    return trace.map((p, i) => {
      const a = (i / n) * Math.PI * 2
      const r1 = rx + Math.sin(i * 1.3) * 8
      const r2 = ry + Math.cos(i * 1.7) * 6
      return { x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r2, speed: p.speed }
    })
  }, [trace, n])
  const colorFor = (s: number) => {
    const t = maxS > minS ? (s - minS) / (maxS - minS) : 0.5
    return lerpColor(AMBER, RED, t)
  }
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox="0 0 220 140" className="w-full h-[160px]">
        {pts.map((p, i) => {
          const q = pts[(i + 1) % n]
          return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={colorFor(p.speed)} strokeWidth={4} strokeLinecap="round" />
        })}
        {pts.length > 0 && <circle cx={pts[0].x} cy={pts[0].y} r={3.5} fill="#fff" stroke="#18181b" strokeWidth={1} />}
      </svg>
      <div className="flex items-center justify-between text-[9px] font-mono-nums text-muted-foreground">
        <span className="text-amber-300/80">{minS} km/h</span>
        <div className="h-2 flex-1 mx-2 rounded-full" style={{ background: `linear-gradient(90deg, ${AMBER}, ${RED})` }} />
        <span className="text-red-300/80">{maxS} km/h</span>
      </div>
    </div>
  )
}

function GaugeViz({ result }: { result: Extract<RunResult, { type: 'gauge' }> }) {
  const pct = result.max > 0 ? Math.max(0, Math.min(1, result.value / result.max)) : 0
  const angle = Math.PI * pct
  const r = 70
  const cx = 80
  const cy = 80
  const start = { x: cx - r, y: cy }
  const end = { x: cx - Math.cos(angle) * r, y: cy - Math.sin(angle) * r }
  const large = pct > 0.5 ? 1 : 0
  const sweep = 1
  const arc = `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`
  const bgArc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const color = pct > 0.85 ? EMERALD : pct > 0.6 ? AMBER : RED
  return (
    <div className="flex flex-col items-center justify-center">
      <svg viewBox="0 0 160 100" className="w-full max-w-[260px]">
        <path d={bgArc} fill="none" stroke="#3f3f46" strokeWidth={10} strokeLinecap="round" />
        <path d={arc} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill="#e4e4e7" fontFamily="ui-monospace, monospace">
          {result.value}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#71717a" fontFamily="ui-monospace, monospace">
          / {result.max}
        </text>
      </svg>
      {result.label && <div className="text-[11px] text-muted-foreground -mt-1">{result.label}</div>}
    </div>
  )
}

// ---------- Canvas widget ----------

function CanvasWidget({
  widget,
  drivers,
  sessions,
  onRemove,
  onRun,
  onParamChange,
}: {
  widget: Widget
  drivers: DriverOption[]
  sessions: SessionSummary[]
  onRemove: (uid: string) => void
  onRun: (uid: string) => void
  onParamChange: (uid: string, name: string, value: string) => void
}) {
  const [sqlOpen, setSqlOpen] = useState(false)
  const params = widget.template.params ?? {}
  const paramKeys = Object.keys(params)
  return (
    <Card className="border-border/50 bg-card/60 p-3 flex flex-col gap-3">
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-red-400 shrink-0">{chartIcon(widget.template.chartType, 'h-4 w-4')}</span>
          <span className="text-sm font-medium truncate">{widget.template.name}</span>
          <Badge variant="outline" className="text-[9px] uppercase border-border/60 text-muted-foreground shrink-0">
            {widget.template.chartType}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="default" onClick={() => onRun(widget.uid)} disabled={widget.running} className="h-7 px-2 text-xs">
            {widget.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => onRemove(widget.uid)} className="h-7 w-7" aria-label="Remove widget">
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove widget</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* params */}
      {paramKeys.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {paramKeys.map((name) => (
            <ParamInput
              key={name}
              name={name}
              type={params[name] ?? 'string'}
              value={widget.params[name] ?? ''}
              drivers={drivers}
              sessions={sessions}
              onChange={(v) => onParamChange(widget.uid, name, v)}
            />
          ))}
        </div>
      )}

      {/* result */}
      <div className="min-h-[160px]">
        {widget.error ? (
          <div className="text-xs text-rose-400 border border-rose-500/30 bg-rose-500/5 rounded-md p-2">
            {widget.error}
          </div>
        ) : widget.result ? (
          <ResultViz result={widget.result} />
        ) : (
          <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-md">
            {paramKeys.length > 0 ? 'Configure params and press Run.' : 'Press Run to execute.'}
          </div>
        )}
      </div>

      {/* footer: metrics + SQL */}
      {(widget.executedSql || widget.latencyMs != null) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {widget.latencyMs != null && (
              <Badge variant="outline" className="font-mono-nums text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-300">
                <Activity className="h-2.5 w-2.5" />
                {widget.latencyMs}ms
              </Badge>
            )}
            {widget.rowsAffected != null && (
              <Badge variant="outline" className="font-mono-nums text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                {widget.rowsAffected} rows
              </Badge>
            )}
            {widget.ranAt && (
              <span className="text-[10px] font-mono-nums text-muted-foreground">
                {new Date(widget.ranAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          {widget.executedSql && (
            <Collapsible open={sqlOpen} onOpenChange={setSqlOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground">
                  <Code2 className="h-3 w-3" />
                  {sqlOpen ? 'Hide SQL' : 'Show SQL'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-1 text-[10px] font-mono-nums text-muted-foreground whitespace-pre-wrap break-all bg-background/60 border border-border/40 rounded-md p-2 max-h-40 overflow-y-auto">
                  {widget.executedSql}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------- Canvas drop zone ----------

function CanvasDropZone({ hasWidgets, children }: { hasWidgets: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[600px] rounded-lg border-2 border-dashed p-3 transition-colors',
        isOver ? 'border-red-500/60 bg-red-500/5' : 'border-border/50 bg-card/30',
        !hasWidgets && 'flex flex-col items-center justify-center',
      )}
    >
      {children}
    </div>
  )
}

// ---------- New template dialog ----------

function NewTemplateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (data: {
    name: string
    discipline: string
    querySql: string
    chartType: ChartType
    schedule: string | null
    params: Record<string, string>
  }) => void
}) {
  const [name, setName] = useState('')
  const [discipline, setDiscipline] = useState('aero')
  const [querySql, setQuerySql] = useState('')
  const [chartType, setChartType] = useState<ChartType>('line')
  const [schedule, setSchedule] = useState('')
  const [paramsText, setParamsText] = useState('{}')

  const submit = () => {
    let params: Record<string, string> = {}
    try {
      const parsed = JSON.parse(paramsText || '{}')
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('not an object')
      }
      params = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)]),
      )
    } catch {
      toast({ title: 'Invalid params', description: 'Params must be a JSON object like {"driver_id":"string"}', variant: 'destructive' })
      return
    }
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    if (!querySql.trim()) {
      toast({ title: 'SQL required', variant: 'destructive' })
      return
    }
    onCreate({
      name: name.trim(),
      discipline,
      querySql: querySql.trim(),
      chartType,
      schedule: schedule.trim() || null,
      params,
    })
    setName('')
    setQuerySql('')
    setParamsText('{}')
    setSchedule('')
    setDiscipline('aero')
    setChartType('line')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New Query Template</DialogTitle>
          <DialogDescription>Define a reusable SQL + chart template. Engineers will drag it onto dashboards.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="t-name">Name</Label>
            <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lap-time degradation" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Discipline</Label>
              <Select value={discipline} onValueChange={setDiscipline}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['aero', 'vehicle_dynamics', 'strategy', 'power_unit', 'tyres', 'devops'].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Chart</Label>
              <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['line', 'bar', 'heatmap', 'track3d', 'gauge'] as ChartType[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-sql">SQL</Label>
            <Textarea
              id="t-sql"
              value={querySql}
              onChange={(e) => setQuerySql(e.target.value)}
              rows={4}
              className="font-mono-nums text-xs"
              placeholder="SELECT lap, lap_time_ms FROM laps WHERE driver_id = :driver_id"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-sched">Schedule (cron, optional)</Label>
              <Input
                id="t-sched"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="0 9 * * 6"
                className="font-mono-nums text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-params">Params (JSON)</Label>
              <Input
                id="t-params"
                value={paramsText}
                onChange={(e) => setParamsText(e.target.value)}
                placeholder='{"driver_id":"string"}'
                className="font-mono-nums text-xs"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>
            <Plus className="h-4 w-4" /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Main view ----------

export function BuilderView() {
  const qc = useQueryClient()
  const { sessions, selectedSessionId } = useAppStore()

  const templatesQ = useQuery({
    queryKey: ['templates'],
    queryFn: async () => (fetch('/api/templates')).then((r) => r.json()) as Promise<{ templates: Template[] }>,
  })
  const driversQ = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (fetch('/api/drivers')).then((r) => r.json()) as Promise<{ drivers: DriverOption[] }>,
  })

  const templates = templatesQ.data?.templates ?? []
  const drivers = driversQ.data?.drivers ?? []

  const [widgets, setWidgets] = useState<Widget[]>([])
  const [autoRun, setAutoRun] = useState(true)
  const [newOpen, setNewOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const addWidget = useCallback(
    (t: Template) => {
      const params: Record<string, string> = { ...(t.params ?? {}) }
      for (const k of Object.keys(params)) {
        if (!params[k]) {
          if (k === 'session_id') params[k] = selectedSessionId ?? sessions[0]?.id ?? ''
          else if (k === 'driver_id') params[k] = drivers[0]?.id ?? ''
        }
      }
      setWidgets((prev) => [
        ...prev,
        {
          uid: `${t.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          template: t,
          params,
        },
      ])
      toast({ title: 'Widget added', description: t.name })
    },
    [selectedSessionId, sessions, drivers],
  )

  const removeWidget = useCallback((uid: string) => {
    setWidgets((prev) => prev.filter((w) => w.uid !== uid))
  }, [])

  const setParam = useCallback((uid: string, name: string, value: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.uid === uid ? { ...w, params: { ...w.params, [name]: value } } : w)),
    )
  }, [])

  const favMut = useMutation({
    mutationFn: async (id: string) =>
      fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'favorite', id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast({ title: 'Favorite toggled' })
    },
    onError: () => toast({ title: 'Failed to toggle favorite', variant: 'destructive' }),
  })

  const createMut = useMutation({
    mutationFn: async (data: {
      name: string
      discipline: string
      querySql: string
      chartType: ChartType
      schedule: string | null
      params: Record<string, string>
    }) =>
      fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...data }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast({ title: 'Template created', description: 'Available in the palette now' })
    },
    onError: () => toast({ title: 'Failed to create template', variant: 'destructive' }),
  })

  const runMut = useMutation({
    mutationFn: async ({
      uid,
      templateId,
      params,
    }: {
      uid: string
      templateId: string
      params: Record<string, string>
    }) => {
      const r = await fetch('/api/templates/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, params }),
      })
      if (!r.ok) throw new Error(`Run failed (${r.status})`)
      return (await r.json()) as RunResponse
    },
    onMutate: ({ uid }) => {
      setWidgets((prev) => prev.map((w) => (w.uid === uid ? { ...w, running: true, error: undefined } : w)))
    },
    onSuccess: (data, { uid }) => {
      setWidgets((prev) =>
        prev.map((w) =>
          w.uid === uid
            ? {
                ...w,
                running: false,
                result: data.result,
                executedSql: data.executedSql,
                latencyMs: data.queryLatencyMs,
                rowsAffected: data.rowsAffected,
                ranAt: data.ranAt,
              }
            : w,
        ),
      )
      toast({
        title: 'Query executed',
        description: `${data.queryLatencyMs}ms · ${data.rowsAffected} rows`,
      })
    },
    onError: (err, { uid }) => {
      setWidgets((prev) => prev.map((w) => (w.uid === uid ? { ...w, running: false, error: String(err) } : w)))
      toast({ title: 'Query failed', description: String(err), variant: 'destructive' })
    },
  })

  const runWidget = useCallback(
    (uid: string) => {
      const w = widgets.find((x) => x.uid === uid)
      if (!w) return
      runMut.mutate({ uid, templateId: w.template.id, params: w.params })
    },
    [widgets, runMut],
  )

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e
      if (over?.id === 'canvas') {
        const tmpl = active.data.current?.template as Template | undefined
        if (tmpl) addWidget(tmpl)
      }
    },
    [addWidget],
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="border-border/50 bg-card/60 p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md border border-red-500/30 bg-red-500/10 flex items-center justify-center text-red-400">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Low-Code Dashboard Builder</h2>
              <p className="text-[11px] text-muted-foreground">Drag SQL templates onto the canvas, configure params, and visualise.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="font-mono-nums text-[10px] border-border/60 gap-1">
                  <Database className="h-3 w-3" /> {templatesQ.isLoading ? '…' : templates.length} templates
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Templates in library</TooltipContent>
            </Tooltip>
            <Badge variant="outline" className="font-mono-nums text-[10px] border-border/60 gap-1">
              <Save className="h-3 w-3" /> {widgets.length} widgets
            </Badge>
            <div className="flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1">
              <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-mono-nums text-muted-foreground">AUTO-RUN</span>
              <Switch checked={autoRun} onCheckedChange={setAutoRun} aria-label="Auto-run toggle" />
              <span className={cn('text-[10px] font-mono-nums', autoRun ? 'text-emerald-300' : 'text-muted-foreground')}>
                {autoRun ? 'ON' : 'OFF'}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast({
                  title: 'Dashboard saved',
                  description: `${widgets.length} widgets persisted to the warehouse`,
                })
              }
            >
              <Save className="h-3.5 w-3.5" /> Save canvas
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New template
            </Button>
          </div>
        </div>
      </Card>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* LEFT: palette */}
          <Card className="border-border/50 bg-card/60 flex flex-col max-h-[calc(100vh-200px)]">
            <div className="flex items-center justify-between p-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium">Query Templates</span>
              </div>
              <Badge variant="outline" className="font-mono-nums text-[9px] border-border/60 text-muted-foreground">
                {templates.length}
              </Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {templatesQ.isLoading && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading templates…
                  </div>
                )}
                {templatesQ.error && (
                  <div className="text-xs text-rose-400 p-3 border border-rose-500/30 bg-rose-500/5 rounded-md">
                    Failed to load templates.
                  </div>
                )}
                {!templatesQ.isLoading && templates.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No templates yet. Click <span className="text-red-400">New template</span>.
                  </div>
                )}
                {templates.map((t) => (
                  <PaletteCard key={t.id} template={t} onAdd={addWidget} onToggleFav={(id) => favMut.mutate(id)} />
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* RIGHT: canvas */}
          <CanvasDropZone hasWidgets={widgets.length > 0}>
            {widgets.length === 0 ? (
              <div className="text-center py-16">
                <Boxes className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <div className="text-sm font-medium">Empty dashboard</div>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                  Drag a template from the left, or click a card to drop a widget here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {widgets.map((w) => (
                  <CanvasWidget
                    key={w.uid}
                    widget={w}
                    drivers={drivers}
                    sessions={sessions}
                    onRemove={removeWidget}
                    onRun={runWidget}
                    onParamChange={setParam}
                  />
                ))}
              </div>
            )}
          </CanvasDropZone>
        </div>
      </DndContext>

      <NewTemplateDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={(d) => createMut.mutate(d)}
      />
    </div>
  )
}
