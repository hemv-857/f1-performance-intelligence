'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  History,
  Filter,
  X,
  Workflow,
  Bot,
  Gauge,
  GitBranch,
  ShieldCheck,
  Server,
  Loader2,
  Activity,
} from 'lucide-react'

// ---- Types ----

interface AuditEntry {
  id: string
  action: string
  category: string
  actor: string
  target: string | null
  detail: string | null
  severity: string // info | success | warning | critical
  meta: Record<string, unknown> | null
  createdAt: string
}

// ---- Static lookups ----

const CATEGORIES = [
  { value: 'all', label: 'All categories' },
  { value: 'devops', label: 'DevOps' },
  { value: 'ai', label: 'AI' },
  { value: 'telemetry', label: 'Telemetry' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'ops', label: 'Ops' },
  { value: 'system', label: 'System' },
] as const

const SEVERITIES = [
  { value: 'all', label: 'All severities' },
  { value: 'success', label: 'Success' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
] as const

const CATEGORY_ICON: Record<string, typeof Workflow> = {
  devops: Workflow,
  ai: Bot,
  telemetry: Gauge,
  strategy: GitBranch,
  ops: ShieldCheck,
  system: Server,
}

const SEVERITY_DOT: Record<string, string> = {
  success: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]',
  info: 'bg-zinc-400',
  warning: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]',
  critical: 'bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.8)] blink',
}

const SEVERITY_RING: Record<string, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/5',
  info: 'border-zinc-500/30 bg-zinc-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-red-500/40 bg-red-500/5',
}

const ACTOR_BADGE: Record<string, string> = {
  strategist: 'border-red-500/40 bg-red-500/10 text-red-300',
  'aero-team': 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  'ci-bot': 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  'devops-bot': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  devops: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  'ai-engineer': 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300',
  strategy: 'border-red-500/40 bg-red-500/10 text-red-300',
  engineer: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  system: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400',
}

// ---- Component ----

export function AuditLogDrawer() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [severity, setSeverity] = useState<string>('all')

  const query = useQuery({
    queryKey: ['audit-log', category, severity],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('limit', '200')
      if (category !== 'all') params.set('category', category)
      if (severity !== 'all') params.set('severity', severity)
      const r = await fetch(`/api/audit-log?${params.toString()}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = (await r.json()) as { entries: AuditEntry[]; count: number }
      return j
    },
    enabled: open,
    refetchInterval: open ? 15000 : false,
  })

  const entries = query.data?.entries ?? []
  const count = query.data?.count ?? 0
  const filtersActive = category !== 'all' || severity !== 'all'

  const clearFilters = () => {
    setCategory('all')
    setSeverity('all')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-border/60 bg-card/40 text-foreground/80 hover:bg-accent hover:text-foreground font-mono-nums text-xs"
          aria-label="Open audit log"
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Audit</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] p-0 border-l-border/60 bg-background/95 backdrop-blur-xl flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border/60 bg-card/60">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <div className="relative h-7 w-7 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center ring-1 ring-border/60">
              <History className="h-4 w-4 text-foreground/80" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />
            </div>
            <div className="leading-tight">
              <div>Engineer Audit Log</div>
              <div className="text-[10px] text-muted-foreground font-mono-nums font-normal">
                All platform actions · auto-tracked
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Filter row */}
        <div className="px-4 py-3 border-b border-border/60 bg-card/40 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
            <Filter className="h-3 w-3" />
            <span>Filter activity</span>
            <Badge
              variant="outline"
              className="ml-auto h-5 font-mono-nums text-[10px] border-border/60 text-muted-foreground"
            >
              {count} {count === 1 ? 'entry' : 'entries'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 w-full text-[11px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3 mr-1" /> Clear filters
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {query.isLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground font-mono-nums">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>loading audit trail…</span>
              </div>
            )}
            {query.isError && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 text-xs p-3 font-mono-nums">
                Failed to load audit log: {(query.error as Error)?.message ?? 'unknown error'}
              </div>
            )}
            {!query.isLoading && entries.length === 0 && (
              <div className="text-center py-10 space-y-2">
                <div className="mx-auto h-10 w-10 rounded-full bg-card/60 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground font-mono-nums">
                  No entries match these filters.
                </div>
              </div>
            )}
            {entries.map((e) => {
              const Icon = CATEGORY_ICON[e.category] ?? Activity
              return <AuditEntryCard key={e.id} entry={e} Icon={Icon} />
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border/60 px-4 py-2 bg-card/40">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono-nums">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />
              auto-refresh 15s
            </span>
            <span>{count} of {count} shown</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---- Entry card ----

function AuditEntryCard({
  entry,
  Icon,
}: {
  entry: AuditEntry
  Icon: typeof Workflow
}) {
  const dot = SEVERITY_DOT[entry.severity] ?? SEVERITY_DOT.info
  const ring = SEVERITY_RING[entry.severity] ?? SEVERITY_RING.info
  const actorCls = ACTOR_BADGE[entry.actor] ?? 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300'

  let relTime = 'just now'
  try {
    relTime = formatDistanceToNow(new Date(entry.createdAt), { addSuffix: false })
  } catch {
    // noop
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border p-3 transition-colors',
        'border-border/50 bg-card/60 backdrop-blur hover:bg-card/80',
        ring,
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Category icon */}
        <div className="relative shrink-0 mt-0.5">
          <div className="h-7 w-7 rounded-md bg-background/80 border border-border/60 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-foreground/80" />
          </div>
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
              dot,
            )}
            aria-hidden
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono-nums text-xs font-bold text-foreground">
              {entry.action}
            </span>
            {entry.target && (
              <span className="font-mono-nums text-[11px] text-muted-foreground truncate">
                → {entry.target}
              </span>
            )}
          </div>

          {entry.detail && (
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
              {entry.detail}
            </p>
          )}

          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-mono-nums font-semibold uppercase tracking-wide',
                actorCls,
              )}
            >
              {entry.actor}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono-nums">
              {relTime} ago
            </span>
            <span className="text-[10px] text-muted-foreground/60 font-mono-nums ml-auto uppercase tracking-wide">
              {entry.category}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
