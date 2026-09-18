'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore, logAudit } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import {
  Download,
  FileText,
  FileJson,
  CheckCircle2,
  Clock,
  Loader2,
  Database,
  Timer,
  Disc3,
  Gauge,
  Fuel,
  GitBranch,
  History,
  Trophy,
  AlertCircle,
} from 'lucide-react'

// ---------- helpers ----------

/**
 * Flatten a JSON array to a CSV string. Nested objects (e.g. `driver: {code, name}`)
 * are flattened to `driver_code, driver_name` columns. Arrays become `;`-joined strings.
 * Values containing `,`, `"`, or newlines are quoted & `"`-escaped per RFC 4180.
 */
function jsonToCsv(data: any[], flattenDepth = 1): string {
  if (!data.length) return ''
  const headers = new Set<string>()
  const rows: Record<string, any>[] = []
  for (const item of data) {
    const flat: Record<string, any> = {}
    const flatten = (obj: any, prefix = '') => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}_${k}` : k
        if (
          v &&
          typeof v === 'object' &&
          !Array.isArray(v) &&
          prefix.split('_').length <= flattenDepth
        ) {
          flatten(v, key)
        } else {
          flat[key] = Array.isArray(v) ? v.join(';') : v
        }
      }
    }
    flatten(item)
    Object.keys(flat).forEach((k) => headers.add(k))
    rows.push(flat)
  }
  const headerArr = Array.from(headers)
  const lines = [headerArr.join(',')]
  for (const row of rows) {
    lines.push(
      headerArr
        .map((h) => {
          const v = row[h]
          if (v == null) return ''
          const s = String(v)
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s
        })
        .join(','),
    )
  }
  return lines.join('\n')
}

/** Trigger a browser download for an in-memory string blob. */
function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // revoke on next tick to ensure the download has started
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Build a filesystem-safe timestamp string for filenames. */
function tsStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

/** Human-readable relative time for the "recent exports" list. */
function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ---------- types ----------

type ExportFormat = 'csv' | 'json'

interface RecentExport {
  id: string
  dataset: string
  format: ExportFormat
  rows: number
  ts: number
  filename: string
}

interface DatasetDef {
  key: string
  name: string
  description: string
  icon: typeof Database
  /** Returns the array of records to export, or null if not ready / unavailable. */
  getRecords: () => any[] | null
  /** True when prerequisite data is still loading. */
  isLoading: boolean
  /** Human-readable reason when records cannot be produced (no session, etc). */
  unavailableReason?: string
}

// ---------- component ----------

export function DataExportDrawer() {
  const { selectedSessionId } = useAppStore()
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [exportingKey, setExportingKey] = useState<string | null>(null)
  const [recentExports, setRecentExports] = useState<RecentExport[]>([])

  // ---- data queries (fire when drawer opens) ----

  // Drivers list → resolve TSU's driverId for analytics endpoints
  // NOTE: uses a unique query key (not ['drivers']) to avoid dedup collision
  // with analytics.tsx / builder.tsx which return the whole { drivers: [...] } object
  const driversQuery = useQuery({
    queryKey: ['drivers-export'],
    queryFn: async () => {
      const r = await fetch('/api/drivers')
      const j = await r.json()
      const drivers = Array.isArray(j?.drivers) ? j.drivers : []
      return drivers as {
        id: string
        code: string
        name: string
        team: string
        isRival: boolean
      }[]
    },
    enabled: open,
    staleTime: 60_000,
  })
  const tsuDriverId = Array.isArray(driversQuery.data) ? driversQuery.data.find((d) => d.code === 'TSU')?.id : undefined

  const hasSession = !!selectedSessionId
  const hasDriver = !!tsuDriverId

  // Session detail (drives session-laps dataset)
  const sessionQuery = useQuery({
    queryKey: ['session-detail-export', selectedSessionId],
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${selectedSessionId}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{
        session?: {
          id: string
          round: number
          type: string
          date: string
          status: string
          circuit?: { name: string; country: string }
          drivers?: {
            driver: { id: string; code: string; name: string; team: string; number: number; isRival: boolean }
            laps: any[]
          }[]
        }
      }>
    },
    enabled: open && hasSession,
    staleTime: 30_000,
  })

  // Delta-P
  const deltaQuery = useQuery({
    queryKey: ['delta-export', selectedSessionId, tsuDriverId],
    queryFn: async () => {
      const r = await fetch(
        `/api/analytics/delta?sessionId=${selectedSessionId}&driverId=${tsuDriverId}`,
      )
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ laps?: any[]; sectorDeltas?: any[]; channelDeltas?: any[]; pairSummary?: any[] }>
    },
    enabled: open && hasSession && hasDriver,
    staleTime: 30_000,
  })

  // Tire degradation
  const degQuery = useQuery({
    queryKey: ['deg-export', selectedSessionId, tsuDriverId],
    queryFn: async () => {
      const r = await fetch(
        `/api/analytics/degradation?sessionId=${selectedSessionId}&driverId=${tsuDriverId}`,
      )
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ curves?: any[]; byCompound?: any[]; driver?: any; baseLapTimeMs?: number }>
    },
    enabled: open && hasSession && hasDriver,
    staleTime: 30_000,
  })

  // Fuel
  const fuelQuery = useQuery({
    queryKey: ['fuel-export', selectedSessionId, tsuDriverId],
    queryFn: async () => {
      const r = await fetch(
        `/api/analytics/fuel?sessionId=${selectedSessionId}&driverId=${tsuDriverId}`,
      )
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ points?: any[]; summary?: any; driver?: any }>
    },
    enabled: open && hasSession && hasDriver,
    staleTime: 30_000,
  })

  // Deployments
  const deploymentsQuery = useQuery({
    queryKey: ['deployments-export'],
    queryFn: async () => {
      const r = await fetch('/api/devops/deployments')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ deployments?: any[] }>
    },
    enabled: open,
    staleTime: 30_000,
  })

  // Audit log
  const auditQuery = useQuery({
    queryKey: ['audit-log-export'],
    queryFn: async () => {
      const r = await fetch('/api/audit-log?limit=200')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ entries?: any[]; count?: number }>
    },
    enabled: open,
    staleTime: 15_000,
  })

  // Leaderboard
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard-export'],
    queryFn: async () => {
      const r = await fetch('/api/leaderboard')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ leaderboard?: any[]; totalActions?: number }>
    },
    enabled: open,
    staleTime: 30_000,
  })

  // ---- dataset catalogue ----

  const datasets: DatasetDef[] = useMemo(
    () => [
      {
        key: 'session-laps',
        name: 'Session laps',
        description: 'Per-lap records for the selected session (all drivers).',
        icon: Timer,
        isLoading: sessionQuery.isLoading,
        unavailableReason: !hasSession ? 'No session selected' : undefined,
        getRecords: () => {
          const drivers = sessionQuery.data?.session?.drivers
          if (!drivers?.length) return null
          const out: any[] = []
          for (const { driver, laps } of drivers) {
            for (const lap of laps) {
              out.push({
                sessionId: selectedSessionId,
                driverCode: driver.code,
                driverName: driver.name,
                driverTeam: driver.team,
                driverNumber: driver.number,
                isRival: driver.isRival,
                ...lap,
              })
            }
          }
          return out
        },
      },
      {
        key: 'delta-p',
        name: 'Delta-P vs rivals',
        description: 'Per-lap & sector deltas for TSU against every rival.',
        icon: GitBranch,
        isLoading: deltaQuery.isLoading,
        unavailableReason: !hasSession
          ? 'No session selected'
          : !hasDriver
            ? 'TSU driver not found'
            : undefined,
        getRecords: () => deltaQuery.data?.laps ?? null,
      },
      {
        key: 'tire-deg',
        name: 'Tire degradation',
        description: 'Tire deg curves & compound breakdown for TSU.',
        icon: Disc3,
        isLoading: degQuery.isLoading,
        unavailableReason: !hasSession
          ? 'No session selected'
          : !hasDriver
            ? 'TSU driver not found'
            : undefined,
        getRecords: () => degQuery.data?.curves ?? null,
      },
      {
        key: 'fuel-trends',
        name: 'Fuel trends',
        description: 'Per-lap fuel burn & cumulative consumption for TSU.',
        icon: Fuel,
        isLoading: fuelQuery.isLoading,
        unavailableReason: !hasSession
          ? 'No session selected'
          : !hasDriver
            ? 'TSU driver not found'
            : undefined,
        getRecords: () => fuelQuery.data?.points ?? null,
      },
      {
        key: 'deployments',
        name: 'Deployments',
        description: 'CI/CD deployment history across all environments.',
        icon: GitBranch,
        isLoading: deploymentsQuery.isLoading,
        getRecords: () => deploymentsQuery.data?.deployments ?? null,
      },
      {
        key: 'audit-log',
        name: 'Audit log',
        description: 'Engineer activity trail (most recent 200 entries).',
        icon: History,
        isLoading: auditQuery.isLoading,
        getRecords: () => auditQuery.data?.entries ?? null,
      },
      {
        key: 'leaderboard',
        name: 'Leaderboard',
        description: 'Engineer gamification scores & action counts.',
        icon: Trophy,
        isLoading: leaderboardQuery.isLoading,
        getRecords: () => leaderboardQuery.data?.leaderboard ?? null,
      },
    ],
    [
      hasSession,
      hasDriver,
      selectedSessionId,
      sessionQuery.data,
      sessionQuery.isLoading,
      deltaQuery.data,
      deltaQuery.isLoading,
      degQuery.data,
      degQuery.isLoading,
      fuelQuery.data,
      fuelQuery.isLoading,
      deploymentsQuery.data,
      deploymentsQuery.isLoading,
      auditQuery.data,
      auditQuery.isLoading,
      leaderboardQuery.data,
      leaderboardQuery.isLoading,
    ],
  )

  // ---- export handler ----

  async function handleExport(ds: DatasetDef, fmt: ExportFormat) {
    if (exportingKey) return
    setExportingKey(ds.key)
    try {
      // If the cached data is missing but should be available, await a refetch.
      let records = ds.getRecords()
      if (records == null && !ds.unavailableReason) {
        // give the underlying query a chance to finish if it's in-flight
        await Promise.race([
          new Promise((r) => setTimeout(r, 4000)),
          // force re-render after the query resolves
          new Promise((r) => setTimeout(r, 250)),
        ])
        records = ds.getRecords()
      }
      if (records == null) {
        const reason = ds.unavailableReason ?? 'data not ready'
        toast.error(`Cannot export ${ds.name}`, { description: reason })
        return
      }
      if (!records.length) {
        toast.warning(`No rows in ${ds.name}`, {
          description: 'The dataset is empty — nothing to export.',
        })
        return
      }

      const n = records.length
      const ext = fmt === 'csv' ? 'csv' : 'json'
      const mime =
        fmt === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
      const content =
        fmt === 'csv'
          ? jsonToCsv(records)
          : JSON.stringify(records, null, 2)
      const filename = `rb-${ds.key}-${fmt}-${tsStamp()}.${ext}`

      downloadBlob(content, filename, mime)

      toast.success(`Exported ${n} rows as ${fmt.toUpperCase()}`, {
        description: filename,
        icon: fmt === 'csv' ? <FileText className="h-4 w-4" /> : <FileJson className="h-4 w-4" />,
      })

      logAudit(
        'pdf_export',
        'telemetry',
        'engineer',
        ds.key,
        `Exported ${n} rows as ${fmt}`,
        'info',
        { dataset: ds.key, format: fmt, rows: n, filename },
      )

      setRecentExports((prev) =>
        [
          {
            id: `${ds.key}-${Date.now()}`,
            dataset: ds.name,
            format: fmt,
            rows: n,
            ts: Date.now(),
            filename,
          },
          ...prev,
        ].slice(0, 5),
      )
    } catch (e: any) {
      toast.error(`Export failed for ${ds.name}`, {
        description: e?.message ?? 'unknown error',
      })
    } finally {
      setExportingKey(null)
    }
  }

  const totalReady = datasets.filter((d) => d.getRecords() != null).length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-border/60 bg-card/40 text-foreground/80 hover:bg-accent hover:text-foreground font-mono-nums text-xs"
          aria-label="Open data export center"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] p-0 border-l-border/60 bg-background/95 backdrop-blur-xl flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border/60 bg-card/60">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <div className="relative h-7 w-7 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center ring-1 ring-emerald-500/30 shadow-[0_0_12px_rgba(52,211,153,0.25)]">
              <Database className="h-4 w-4 text-white" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />
            </div>
            <div className="leading-tight">
              <div>Data Export Center</div>
              <div className="text-[10px] text-muted-foreground font-mono-nums font-normal">
                Export platform data as CSV or JSON
              </div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Choose a dataset and an export format. Files download to your machine
            with a timestamped filename.
          </SheetDescription>
        </SheetHeader>

        {/* Format toggle + summary */}
        <div className="px-4 py-3 border-b border-border/60 bg-card/40 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
              <Gauge className="h-3 w-3" />
              <span>Default format</span>
            </div>
            <Badge
              variant="outline"
              className="h-5 font-mono-nums text-[10px] border-emerald-500/40 text-emerald-300"
            >
              {totalReady}/{datasets.length} ready
            </Badge>
          </div>
          <ToggleGroup
            type="single"
            value={format}
            onValueChange={(v) => {
              if (v === 'csv' || v === 'json') setFormat(v)
            }}
            className="w-full grid grid-cols-2 rounded-md border border-border/60 bg-background/60"
          >
            <ToggleGroupItem
              value="csv"
              variant="outline"
              className="h-8 gap-1.5 text-xs font-mono-nums data-[state=on]:bg-emerald-500/15 data-[state=on]:text-emerald-300 data-[state=on]:border-emerald-500/40"
            >
              <FileText className="h-3.5 w-3.5" />
              CSV
            </ToggleGroupItem>
            <ToggleGroupItem
              value="json"
              variant="outline"
              className="h-8 gap-1.5 text-xs font-mono-nums data-[state=on]:bg-emerald-500/15 data-[state=on]:text-emerald-300 data-[state=on]:border-emerald-500/40"
            >
              <FileJson className="h-3.5 w-3.5" />
              JSON
            </ToggleGroupItem>
          </ToggleGroup>
          {driversQuery.isError && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-300 font-mono-nums">
              <AlertCircle className="h-3 w-3" />
              <span>Failed to load drivers list — analytics exports unavailable.</span>
            </div>
          )}
        </div>

        {/* Dataset list */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {datasets.map((ds) => {
              const records = ds.getRecords()
              const count = records?.length ?? null
              const ready = records != null
              const exporting = exportingKey === ds.key
              const unavailable = !!ds.unavailableReason
              return (
                <div
                  key={ds.key}
                  className={cn(
                    'relative rounded-lg border p-3 transition-colors',
                    'border-border/50 bg-card/60 backdrop-blur',
                    ready
                      ? 'hover:bg-card/80 hover:border-emerald-500/30'
                      : 'opacity-80',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="relative shrink-0 mt-0.5">
                      <div className="h-7 w-7 rounded-md bg-background/80 border border-border/60 flex items-center justify-center">
                        <ds.icon className="h-3.5 w-3.5 text-foreground/80" />
                      </div>
                      {ready && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {ds.name}
                        </span>
                        {count != null ? (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 font-mono-nums text-[9px] border-emerald-500/40 text-emerald-300"
                          >
                            {count.toLocaleString()} rows
                          </Badge>
                        ) : ds.isLoading ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono-nums">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            loading…
                          </span>
                        ) : unavailable ? (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 font-mono-nums text-[9px] border-amber-500/40 text-amber-300"
                          >
                            {ds.unavailableReason}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                        {ds.description}
                      </p>

                      {/* export buttons */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant={format === 'csv' ? 'default' : 'outline'}
                          disabled={exporting || !ready}
                          onClick={() => handleExport(ds, 'csv')}
                          className="h-7 gap-1 text-[11px] font-mono-nums"
                        >
                          {exporting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          CSV
                        </Button>
                        <Button
                          size="sm"
                          variant={format === 'json' ? 'default' : 'outline'}
                          disabled={exporting || !ready}
                          onClick={() => handleExport(ds, 'json')}
                          className="h-7 gap-1 text-[11px] font-mono-nums"
                        >
                          {exporting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileJson className="h-3 w-3" />
                          )}
                          JSON
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* Recent exports */}
        <div className="border-t border-border/60 bg-card/40">
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
              <Clock className="h-3 w-3" />
              <span>Recent exports</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono-nums">
              {recentExports.length}/5
            </span>
          </div>
          <div className="px-4 pb-3 max-h-32 overflow-y-auto">
            {recentExports.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-muted-foreground font-mono-nums">
                No exports yet
              </div>
            ) : (
              <ul className="space-y-1">
                {recentExports.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 text-[10px] font-mono-nums py-1 border-b border-border/40 last:border-0"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-foreground truncate">
                      {r.dataset}
                    </span>
                    <span className="text-muted-foreground uppercase">{r.format}</span>
                    <span className="text-muted-foreground">{r.rows} rows</span>
                    <span className="ml-auto text-muted-foreground">{relTime(r.ts)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
