'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast, Toaster as SonnerToaster } from 'sonner'
import { StatCard, SectionHeader, StatusBadge } from '@/components/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { logAudit } from '@/lib/store'
import {
  Workflow,
  GitBranch,
  GitCommit,
  ShieldCheck,
  Rocket,
  Undo2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Cpu,
  FileCode2,
  Copy,
  Download,
  Terminal,
  Box,
} from 'lucide-react'

// ---- API types ----

interface Deployment {
  id: string
  version: string
  feature: string
  environment: string
  canaryPct: number
  status: string
  triggeredBy: string
  commitSha: string
  testsPassed: number
  testsFailed: number
  regressionScore: number
  createdAt: string
  rolledBackAt?: string | null
}

interface Incident {
  id: string
  playbook: string
  trigger: string
  status: string
  actions: string[]
  durationMs: number
  createdAt: string
}

// ---- Pipeline stages (hardcoded, made to look alive) ----

type StageStatus = 'pass' | 'running' | 'failed' | 'pending'

interface PipelineStage {
  name: string
  icon: React.ReactNode
  status: StageStatus
}

const stageStatusStyle: Record<StageStatus, string> = {
  pass: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  running: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
  failed: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
  pending: 'border-zinc-700 bg-zinc-800/40 text-zinc-400',
}

const stageLineColor: Record<StageStatus, string> = {
  pass: 'bg-emerald-500',
  running: 'bg-amber-500',
  failed: 'bg-rose-500',
  pending: 'bg-zinc-700',
}

const initialStages: PipelineStage[] = [
  { name: 'Commit', icon: <GitCommit className="h-3.5 w-3.5" />, status: 'pass' },
  { name: 'Build', icon: <Workflow className="h-3.5 w-3.5" />, status: 'pass' },
  {
    name: 'Test · regression vs historical telemetry',
    icon: <FlaskConical className="h-3.5 w-3.5" />,
    status: 'running',
  },
  { name: 'Security Scan', icon: <ShieldCheck className="h-3.5 w-3.5" />, status: 'pending' },
  { name: 'Deploy Canary 10%', icon: <GitBranch className="h-3.5 w-3.5" />, status: 'pending' },
  { name: 'Canary 50%', icon: <GitBranch className="h-3.5 w-3.5" />, status: 'pending' },
  { name: 'Production 100%', icon: <Rocket className="h-3.5 w-3.5" />, status: 'pending' },
]

// ---- Regression test panel (hardcoded) ----

interface RegressionTest {
  name: string
  baseline: string
  status: 'pass' | 'fail' | 'pending'
  score: number // 0..1, higher = less regression
}

const regressionTests: RegressionTest[] = [
  { name: 'Lap-time delta model', baseline: 'vs 2024 Suzuka baseline', status: 'pass', score: 0.92 },
  { name: 'Brake-temp diff engine', baseline: 'vs 2023 Austin', status: 'pass', score: 0.88 },
  { name: 'DRS activation logic', baseline: 'vs 2024 Singapore', status: 'pending', score: 0.71 },
  { name: 'Fuel-burn model', baseline: 'vs 2024 Austin', status: 'fail', score: 0.42 },
]

const regressionStatusStyle: Record<RegressionTest['status'], string> = {
  pass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  fail: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
}

// ---- Rollback timeline (visual, 0..60s window) ----

interface RollbackStep {
  label: string
  at: number // seconds into the 60s window
  icon: React.ReactNode
  color: string
}

const rollbackSteps: RollbackStep[] = [
  { label: 'Detect', at: 6, icon: <AlertTriangle className="h-3.5 w-3.5" />, color: '#f87171' },
  { label: 'Revert', at: 24, icon: <Undo2 className="h-3.5 w-3.5" />, color: '#fbbf24' },
  { label: 'Notify', at: 38, icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: '#34d399' },
]

// ---- Sparkline arrays for the metrics row ----

const sparkDeployTime = [310, 280, 295, 260, 252, 252, 252, 252] // seconds (lower better)
const sparkRollback = [62, 55, 48, 44, 41, 40, 38, 38]
const sparkCanary = [82, 86, 88, 90, 91, 92, 93, 94]
const sparkDeploysWeekend = [0, 0, 1, 1, 1, 2, 2, 2]

function fmtSeconds(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60)
    const r = Math.round(s % 60)
    return `${m}m${String(r).padStart(2, '0')}s`
  }
  return `${Math.round(s)}s`
}

// ===========================================================

export function DevOpsView() {
  const qc = useQueryClient()
  const [stages, setStages] = useState<PipelineStage[]>(initialStages)
  const [triggering, setTriggering] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- Data queries ----
  const depQ = useQuery({
    queryKey: ['deployments'],
    queryFn: async () => {
      const r = await fetch('/api/devops/deployments')
      if (!r.ok) throw new Error('failed to load deployments')
      return (await r.json()) as { deployments: Deployment[] }
    },
    refetchInterval: 15000,
  })

  const incQ = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const r = await fetch('/api/devops/incidents')
      if (!r.ok) throw new Error('failed to load incidents')
      return (await r.json()) as { incidents: Incident[] }
    },
    refetchInterval: 30000,
  })

  const runningCanary = useMemo(
    () => (depQ.data?.deployments ?? []).find((d) => d.status === 'running'),
    [depQ.data],
  )

  const rollbackIncident = useMemo(
    () => (incQ.data?.incidents ?? []).find((i) => i.playbook === 'rollback-deploy'),
    [incQ.data],
  )

  // ---- Mutations ----
  const promoteMut = useMutation({
    mutationFn: async (version: string) => {
      const r = await fetch('/api/devops/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote', version }),
      })
      if (!r.ok) throw new Error('promote failed')
      return (await r.json()) as { deployment: Deployment; message: string }
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Canary promoted')
      qc.invalidateQueries({ queryKey: ['deployments'] })
      logAudit(
        'deploy_promote',
        'devops',
        'engineer',
        data.deployment?.version ?? 'unknown',
        data.message ?? 'Canary promoted',
        'success',
        { canaryPct: data.deployment?.canaryPct },
      )
    },
    onError: () => toast.error('Failed to promote canary — see server logs'),
  })

  const rollbackMut = useMutation({
    mutationFn: async (version: string) => {
      const r = await fetch('/api/devops/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', version }),
      })
      if (!r.ok) throw new Error('rollback failed')
      return (await r.json()) as { deployment: Deployment; message: string }
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Rolled back in <1 min')
      qc.invalidateQueries({ queryKey: ['deployments'] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
      logAudit(
        'deploy_rollback',
        'devops',
        'engineer',
        data.deployment?.version ?? 'unknown',
        data.message ?? 'Rolled back in <1 min',
        'warning',
        { status: data.deployment?.status },
      )
    },
    onError: () => toast.error('Rollback failed — manual intervention required'),
  })

  // ---- Trigger CI run simulation ----
  const triggerCI = () => {
    if (triggering) return
    setTriggering(true)
    setCountdown(30)
    // reset to first stage running
    setStages(
      initialStages.map((s, i) =>
        i === 0 ? { ...s, status: 'running' } : { ...s, status: 'pending' },
      ),
    )
    let idx = 0
    const advance = () => {
      setStages((prev) => {
        const next = [...prev]
        if (idx < next.length) {
          next[idx] = { ...next[idx], status: 'pass' }
        }
        idx += 1
        if (idx < next.length) {
          next[idx] = { ...next[idx], status: 'running' }
        }
        return next
      })
      if (idx < initialStages.length) {
        timerRef.current = setTimeout(advance, 650)
      } else {
        setTriggering(false)
        toast.success('CI run completed · all stages passed')
      }
    }
    timerRef.current = setTimeout(advance, 650)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const deployments = depQ.data?.deployments ?? []

  return (
    <div className="space-y-4">
      {/* Section 6 (rendered first for KPI context): CI/CD metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Mean deploy time"
          value={fmtSeconds(252)}
          sub="Commit → production 100%"
          accent="emerald"
          icon={<Clock className="h-4 w-4" />}
          spark={sparkDeployTime}
        />
        <StatCard
          label="Rollback time"
          value={fmtSeconds(38)}
          sub="Target < 60s · within SLA"
          accent="red"
          icon={<Undo2 className="h-4 w-4" />}
          spark={sparkRollback}
        />
        <StatCard
          label="Canary success rate"
          value={94}
          unit="%"
          sub="Last 50 canary promotions"
          accent="amber"
          icon={<TrendingUp className="h-4 w-4" />}
          spark={sparkCanary}
        />
        <StatCard
          label="Deploys this race weekend"
          value={2}
          sub="Singapore GP · FP1 → Race"
          accent="default"
          icon={<Cpu className="h-4 w-4" />}
          spark={sparkDeploysWeekend}
        />
      </div>

      {/* Section 1: CI/CD pipeline visualisation */}
      <Card className="border-border/50 bg-card/60 backdrop-blur p-4">
        <SectionHeader
          title="CI/CD Pipeline"
          subtitle="Commit → regression suite → security scan → canary rollout"
          right={
            <Button
              size="sm"
              onClick={triggerCI}
              disabled={triggering}
              className="bg-red-500/90 hover:bg-red-500 text-white border-0"
            >
              {triggering ? (
                <>
                  <Workflow className="h-3.5 w-3.5 animate-pulse" /> Running…
                </>
              ) : (
                <>
                  <Rocket className="h-3.5 w-3.5" /> Trigger CI run
                </>
              )}
            </Button>
          }
        />
        <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
          {stages.map((s, i) => (
            <div key={s.name} className="flex items-center min-w-0 flex-1 last:flex-none">
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 min-w-[120px] flex-1',
                  stageStatusStyle[s.status],
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      s.status === 'running' && 'animate-pulse',
                    )}
                  >
                    {s.icon}
                  </span>
                  <span className="text-[11px] font-mono-nums uppercase tracking-wide">
                    {i + 1}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-center leading-tight">
                  {s.name}
                </span>
                <span className="text-[9px] font-mono-nums uppercase tracking-wider opacity-80">
                  {s.status}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div className="relative h-0.5 w-6 sm:w-10 shrink-0 self-center">
                  <div className="absolute inset-0 bg-zinc-800" />
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 transition-all duration-500',
                      stageLineColor[s.status],
                    )}
                    style={{
                      width:
                        s.status === 'pass'
                          ? '100%'
                          : s.status === 'running'
                            ? '55%'
                            : '0%',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-mono-nums text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> pass
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> running
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> failed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-zinc-600" /> pending
          </span>
        </div>
      </Card>

      {/* Section 3: Canary rollout progress (above the table — contextual) */}
      {runningCanary ? (
        <CanaryRolloutCard key={runningCanary.id} canary={runningCanary} />
      ) : (
        <Card className="border-border/50 bg-card/60 backdrop-blur p-4">
          <SectionHeader title="Canary Rollout" subtitle="No active canary promotion in progress" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Last deployment reached 100% production. Trigger a new CI run to start the next canary.
          </div>
        </Card>
      )}

      {/* Section 2: Deployment history + canary control */}
      <Card className="border-border/50 bg-card/60 backdrop-blur p-4">
        <SectionHeader
          title="Deployment History"
          subtitle="Promote canary or rollback — auto-invalidates on mutation"
          right={
            <div className="flex items-center gap-2">
              {depQ.isFetching && (
                <span className="text-[10px] font-mono-nums text-muted-foreground animate-pulse">
                  syncing…
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-border/60 bg-background/40"
                onClick={() => qc.invalidateQueries({ queryKey: ['deployments'] })}
              >
                <Clock className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Version</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Feature</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Env</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">Canary %</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">Tests</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">Regression</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {depQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    Loading deployments…
                  </TableCell>
                </TableRow>
              ) : deployments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    No deployments yet.
                  </TableCell>
                </TableRow>
              ) : (
                deployments.map((d) => {
                  const canPromote =
                    d.status === 'running' &&
                    (d.canaryPct === 10 || d.canaryPct === 50)
                  const total = d.testsPassed + d.testsFailed
                  const regGood = d.regressionScore >= 0.8
                  const regMid = d.regressionScore >= 0.6
                  return (
                    <TableRow
                      key={d.id}
                      className={cn(
                        d.status === 'rolled_back' && 'opacity-60',
                        d.status === 'running' && 'bg-amber-500/5',
                      )}
                    >
                      <TableCell className="font-mono-nums text-xs font-bold">
                        <div className="flex flex-col">
                          <span>{d.version}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {d.commitSha.slice(0, 7)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[180px]">{d.feature}</span>
                          <span className="text-[10px] text-muted-foreground font-mono-nums">
                            by {d.triggeredBy}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-mono-nums text-[10px]',
                            d.environment === 'production'
                              ? 'border-red-500/40 bg-red-500/10 text-red-300'
                              : d.environment === 'staging'
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                : 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
                          )}
                        >
                          {d.environment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono-nums text-xs">
                        <span
                          className={cn(
                            d.canaryPct === 100
                              ? 'text-emerald-300'
                              : d.canaryPct > 0
                                ? 'text-amber-300'
                                : 'text-muted-foreground',
                          )}
                        >
                          {d.canaryPct}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono-nums text-xs">
                        <span
                          className={cn(
                            d.testsFailed > 0
                              ? 'text-rose-300'
                              : 'text-emerald-300',
                          )}
                        >
                          {d.testsPassed}/{total}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="h-1.5 w-12 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={cn(
                                'h-full',
                                regGood
                                  ? 'bg-emerald-500'
                                  : regMid
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500',
                              )}
                              style={{ width: `${Math.round((d.regressionScore ?? 0) * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono-nums text-[10px] text-muted-foreground">
                            {d.regressionScore != null ? d.regressionScore.toFixed(2) : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canPromote ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 px-2 text-[11px]"
                              disabled={promoteMut.isPending}
                              onClick={() => promoteMut.mutate(d.version)}
                            >
                              <TrendingUp className="h-3 w-3" />
                              Promote canary →
                            </Button>
                          ) : null}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 bg-rose-500/90 hover:bg-rose-500 text-white px-2 text-[11px]"
                                disabled={
                                  rollbackMut.isPending ||
                                  d.status === 'rolled_back' ||
                                  d.status === 'pending'
                                }
                                onClick={() => rollbackMut.mutate(d.version)}
                              >
                                <Undo2 className="h-3 w-3" />
                                Rollback
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              className="bg-zinc-900 border border-border/60 text-foreground"
                            >
                              Instant revert — &lt;1 min target
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Section 4 + 5: Rollback automation + Regression panel (two columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rollback automation */}
        <Card className="border-border/50 bg-card/60 backdrop-blur p-4">
          <SectionHeader
            title="Rollback Automation"
            subtitle="<1 min guarantee · auto-revert on failed canary"
            right={
              rollbackIncident ? (
                <Badge
                  variant="outline"
                  className={cn(
                    'font-mono-nums',
                    rollbackIncident.durationMs <= 60000
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-rose-500/50 bg-rose-500/10 text-rose-300',
                  )}
                >
                  {rollbackIncident.durationMs <= 60000 ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {rollbackIncident.durationMs <= 60000 ? 'within target' : 'over target'}
                </Badge>
              ) : null
            }
          />

          {/* 60s timeline */}
          <div className="relative h-12 mb-3">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-zinc-800" />
            {/* Target marker at 60s */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-px h-6 bg-zinc-600"
              style={{ left: '100%', transform: 'translateX(-100%) translateY(-50%)' }}
            />
            <span className="absolute right-0 top-0 text-[9px] font-mono-nums text-muted-foreground">
              60s target
            </span>
            {rollbackSteps.map((step) => (
              <Tooltip key={step.label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                    style={{ left: `${(step.at / 60) * 100}%` }}
                  >
                    <span
                      className="block h-3 w-3 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: step.color }}
                    />
                    <span className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono-nums text-muted-foreground group-hover:text-foreground">
                      {step.label} · {step.at}s
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-zinc-900 border border-border/60 text-foreground"
                >
                  {step.label} phase · +{step.at}s
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <Separator className="my-3 bg-border/50" />

          {rollbackIncident ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Latest rollback run · playbook{' '}
                  <span className="font-mono-nums text-foreground">
                    {rollbackIncident.playbook}
                  </span>
                </span>
                <span className="font-mono-nums text-muted-foreground">
                  trigger: {rollbackIncident.trigger}
                </span>
              </div>
              <div className="rounded-md border border-border/50 bg-background/40 divide-y divide-border/30">
                {rollbackIncident.actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 px-2.5 py-2 text-[11px]">
                    <span
                      className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: rollbackSteps[i % rollbackSteps.length].color }}
                    />
                    <span className="text-muted-foreground">{a}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono-nums pt-1">
                <span className="text-muted-foreground">Actual duration</span>
                <span
                  className={cn(
                    rollbackIncident.durationMs <= 60000
                      ? 'text-emerald-300'
                      : 'text-rose-300',
                  )}
                >
                  {(rollbackIncident.durationMs / 1000).toFixed(1)}s
                  <span className="text-muted-foreground ml-2">
                    / 60.0s target
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              No rollback runs recorded — trigger one from the deployment table.
            </div>
          )}
        </Card>

        {/* Regression test panel */}
        <Card className="border-border/50 bg-card/60 backdrop-blur p-4">
          <SectionHeader
            title="Regression Test Panel"
            subtitle="Automated testing · simulation tools validated against historical telemetry"
            right={
              <Badge
                variant="outline"
                className="border-red-500/40 bg-red-500/10 text-red-300 font-mono-nums"
              >
                <FlaskConical className="h-3 w-3 mr-1" />
                {regressionTests.filter((t) => t.status === 'pass').length}/
                {regressionTests.length} passing
              </Badge>
            }
          />
          <div className="space-y-2.5">
            {regressionTests.map((t) => (
              <div
                key={t.name}
                className="rounded-md border border-border/50 bg-background/40 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono-nums">
                      {t.baseline}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-mono-nums text-[10px]',
                      regressionStatusStyle[t.status],
                    )}
                  >
                    {t.status === 'pass' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {t.status === 'fail' && <XCircle className="h-3 w-3 mr-1" />}
                    {t.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                    {t.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        t.status === 'pass'
                          ? 'bg-emerald-500'
                          : t.status === 'pending'
                            ? 'bg-amber-500'
                            : 'bg-rose-500',
                      )}
                      style={{ width: `${Math.round(t.score * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono-nums text-[10px] text-muted-foreground w-10 text-right">
                    {t.score.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-3 bg-border/50" />
          <div className="text-[10px] text-muted-foreground font-mono-nums">
            Score = similarity to historical baseline (1.00 = no regression).
            Threshold for auto-promote: ≥ 0.80.
          </div>
        </Card>
      </div>

      {/* Section 7: Pipeline artifacts (IaC / CI YAML viewer) */}
      <PipelineArtifactsCard />

      {/* Sonner toaster scoped to this view (self-contained) */}
      <SonnerToaster
        position="bottom-right"
        theme="dark"
        richColors
        closeButton
      />
    </div>
  )
}

// ---- Canary rollout card (self-contained countdown state) ----

function CanaryRolloutCard({ canary }: { canary: Deployment }) {
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 30 : c - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <Card className="border-amber-500/40 bg-card/60 backdrop-blur p-4">
      <SectionHeader
        title="Canary Rollout — Live"
        subtitle={`Auto-promote engaged for ${canary.version}`}
        right={
          <Badge
            variant="outline"
            className="border-amber-500/50 bg-amber-500/10 text-amber-300 font-mono-nums"
          >
            <Clock className="h-3 w-3 mr-1" />
            auto-promote in {countdown}s
          </Badge>
        }
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-amber-400" />
            <span className="font-medium">{canary.feature}</span>
            <span className="font-mono-nums text-xs text-muted-foreground">
              {canary.commitSha.slice(0, 7)}
            </span>
          </div>
          <span className="font-mono-nums text-lg font-bold text-amber-300">
            {canary.canaryPct}%
          </span>
        </div>
        <div className="relative h-4 rounded-full bg-zinc-800 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
            initial={{ width: '0%' }}
            animate={{ width: `${canary.canaryPct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 18 }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] animate-pulse" />
          </motion.div>
          {/* Threshold markers at 10/50/100 */}
          {[10, 50].map((p) => (
            <div
              key={p}
              className="absolute inset-y-0 w-px bg-zinc-600/70"
              style={{ left: `${p}%` }}
            >
              <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-mono-nums text-muted-foreground">
                {p}%
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono-nums text-muted-foreground">
          <span>0%</span>
          <span>10% canary</span>
          <span>50% canary</span>
          <span>100% production</span>
        </div>
      </div>
    </Card>
  )
}

// ===========================================================
// Section 7: Pipeline artifacts (IaC / CI YAML viewer)
// ===========================================================

interface PipelineArtifact {
  filename: string
  type: 'YAML' | 'K8s manifest' | 'dbt SQL'
  content: string
}

const CI_CD_YAML = `# .github/workflows/ci-cd.yml
# F1 Performance Intelligence Platform — continuous delivery pipeline
name: ci-cd

on:
  push:
    branches: [main, release/*]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      promote_to:
        description: 'Manual canary gate (50|100)'
        required: false
        default: '50'

concurrency:
  group: ci-cd-\${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read
  id-token: write   # required for OIDC + K8s deploy

env:
  REGISTRY: ghcr.io/racing-bulls/f1-platform
  IMAGE_TAG: \${{ github.sha }}

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'bun' }
      - run: bun install --frozen-lockfile
      - run: bun run lint

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'bun' }
      - run: bun install --frozen-lockfile
      - name: Regression suite vs historical telemetry
        run: bun run test:regression -- --baseline seasons=2023,2024
      - name: Sub-2s query budget assertion
        run: bun run test:query-budget -- --p95-ms 2000 --history 5y

  security-scan:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - name: Trivy SCA
        uses: aquasecurity/trivy-action@0.20.0
        with: { severity: 'CRITICAL,HIGH', exit-code: '1' }
      - name: CodeQL
        uses: github/codeql-action/analyze@v3

  build:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: \${{ env.REGISTRY }}:\${{ env.IMAGE_TAG }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-canary:
    runs-on: ubuntu-latest
    needs: build
    environment: canary-10pct
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-kubectl@v4
      - name: Auth to race-edge cluster (OIDC)
        run: |
          gcloud auth login --brief --cred-file=\${{ secrets.GCP_WIF }}
          gcloud container clusters get-credentials race-edge --region=europe-west1
      - name: Canary 10% rollout
        run: |
          kubectl set image deploy/telemetry-ingest ingest=\${{ env.REGISTRY }}:\${{ env.IMAGE_TAG }}
          kubectl patch hpa telemetry-ingest -p '{"spec":{"minReplicas":4}}'
          kubectl rollout status deploy/telemetry-ingest --timeout=180s
      - name: Soak window (10 min)
        run: sleep 600
      - name: Smoke test canary
        run: bun run scripts/smoke-canary.ts -- --canary 10

  promote-canary:
    runs-on: ubuntu-latest
    needs: deploy-canary
    environment: canary-promote-gate   # manual approval
    if: github.event_name == 'workflow_dispatch'
    steps:
      - name: Promote to \${{ github.event.inputs.promote_to }}%
        run: |
          kubectl scale deploy/telemetry-ingest --replicas=\${{ github.event.inputs.promote_to == '100' && 12 || 8 }}
          kubectl patch hpa telemetry-ingest -p '{"spec":{"maxReplicas":12}}'

  rollback:
    runs-on: ubuntu-latest
    needs: deploy-canary
    if: failure()
    steps:
      - uses: actions/checkout@v4
      - run: |
          kubectl rollout undo deploy/telemetry-ingest
          kubectl annotate deploy/telemetry-ingest rb.com/rolled-back-by="\${{ github.actor }}" --overwrite
          gh api -X POST /repos/\${{ github.repository }}/issues \\
            -f title="Auto-rollback: \${{ env.IMAGE_TAG }}" --silent
`

const K8S_TELEMETRY_INGEST_YAML = `# k8s/telemetry-ingest.yaml
# Kafka → Spark ingest pods (race-edge cluster, low-latency path)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: telemetry-ingest
  namespace: f1-platform
  labels:
    app: telemetry-ingest
    tier: realtime
spec:
  replicas: 6
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels: { app: telemetry-ingest }
  template:
    metadata:
      labels: { app: telemetry-ingest, tier: realtime }
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9100"
        rb.com/last-applied: "\${IMAGE_TAG}"
    spec:
      nodeSelector:
        topology.kubernetes.io/region: europe-west1
        rb.com/node-pool: race-edge
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm: { labelSelector: { matchLabels: { app: telemetry-ingest } }, topologyKey: kubernetes.io/hostname }
      containers:
        - name: ingest
          image: ghcr.io/racing-bulls/f1-platform:\${IMAGE_TAG}
          imagePullPolicy: IfNotPresent
          ports:
            - { name: grpc, containerPort: 8080 }
            - { name: metrics, containerPort: 9100 }
          env:
            - { name: KAFKA_BROKERS, valueFrom: { secretKeyRef: { name: kafka-edge, key: brokers } } }
            - { name: KAFKA_TOPIC, value: "telemetry-f1" }
            - { name: CONSUMER_GROUP, value: "telemetry-ingest-v2" }
            - { name: DOWNSTREAM_SINK, value: "spark-streaming:9092" }
          resources:
            requests: { cpu: "500m", memory: "768Mi" }
            limits:   { cpu: "1500m", memory: "2Gi" }
          livenessProbe:
            httpGet: { path: /healthz, port: grpc }
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          readinessProbe:
            httpGet: { path: /readyz, port: grpc }
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 2
          volumeMounts:
            - { name: checkpoint, mountPath: /var/lib/checkpoint }
      volumes:
        - name: checkpoint
          persistentVolumeClaim: { claimName: ingest-checkpoint-pvc }
---
apiVersion: v1
kind: Service
metadata:
  name: telemetry-ingest
  namespace: f1-platform
spec:
  type: ClusterIP
  selector: { app: telemetry-ingest }
  ports:
    - { name: grpc, port: 8080, targetPort: 8080 }
    - { name: metrics, port: 9100, targetPort: 9100 }
`

const K8S_SPARK_STREAMING_YAML = `# k8s/spark-streaming.yaml
# Spark Structured Streaming aggregation jobs (5s tumbling windows)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spark-streaming
  namespace: f1-platform
  labels: { app: spark-streaming, tier: realtime }
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 25%, maxUnavailable: 0 }
  selector:
    matchLabels: { app: spark-streaming }
  template:
    metadata:
      labels: { app: spark-streaming, tier: realtime }
    spec:
      nodeSelector:
        rb.com/node-pool: race-edge
        rb.com/workload-profile: streaming
      containers:
        - name: spark-driver
          image: ghcr.io/racing-bulls/spark-streaming:3.5.1-rb1
          imagePullPolicy: IfNotPresent
          args:
            - /opt/spark/bin/spark-submit
            - --master;k8s://https://kubernetes.default.svc
            - --conf;spark.app.name=f1-aggregation
            - --conf;spark.streaming.backpressure.enabled=true
            - --conf;spark.streaming.kafka.maxRatePerPartition=12000
            - --conf;spark.sql.streaming.checkpointLocation=/checkpoint/agg-5s-lap
            - --class;com.racingbulls.streaming.DeltaPAggregator
            - /opt/spark/jobs/f1-aggregator.jar
            - --input-topic=telemetry-f1
            - --output-topic=delta-p-live
            - --window=5s
          env:
            - { name: SPARK_DRIVER_MEMORY, value: "4g" }
            - { name: SPARK_DRIVER_CORES, value: "2" }
            - { name: CHECKPOINT_RETENTION, value: "72h" }
          resources:
            requests: { cpu: "1500m", memory: "4Gi" }
            limits:   { cpu: "3000m", memory: "6Gi" }
          livenessProbe:
            exec: { command: ["/bin/sh", "-c", "curl -fsS localhost:4040/api/v1/status || exit 1"] }
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet: { path: /api/v1/status, port: 4040 }
            initialDelaySeconds: 15
            periodSeconds: 10
          volumeMounts:
            - { name: checkpoint, mountPath: /checkpoint }
            - { name: spark-logs, mountPath: /var/log/spark }
      volumes:
        - name: checkpoint
          persistentVolumeClaim: { claimName: spark-checkpoint-pvc }
        - name: spark-logs
          emptyDir: {}
`

const K8S_HPA_TELEMETRY_YAML = `# k8s/hpa-telemetry.yaml
# HorizontalPodAutoscaler — telemetry-ingest scales with race weekends
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: telemetry-ingest
  namespace: f1-platform
  labels: { app: telemetry-ingest, tier: realtime }
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: telemetry-ingest
  minReplicas: 4
  maxReplicas: 12
  scaleDown:
    stabilizationWindowSeconds: 300     # 5 min before scaling down
    policies:
      - { type: Percent, value: 25, periodSeconds: 60 }
  scaleUp:
    stabilizationWindowSeconds: 30
    policies:
      - { type: Percent, value: 100, periodSeconds: 30 }
      - { type: Pods,     value: 4,    periodSeconds: 30 }
    selectPolicy: Max
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
    - type: Pods
      pods:
        metric:
          name: kafka_consumer_lag_seconds
        target:
          type: AverageValue
          averageValue: "5"
  behavior:
    terminationGracePeriodSeconds: 60
`

const DBT_FCT_DELTA_P_SECTOR_SQL = `-- dbt/models/fct_delta_p_sector.sql
-- Per-sector delta-P vs rivals (positive = we are slower than rival).
-- Joins stg_laps (cleaned) with int_delta_p (computed per-lap delta).
{{ config(
    materialized='incremental',
    cluster_by=['session_id','driver_id'],
    unique_key=['session_id','driver_id','rival_id','lap_number','sector'],
    on_schema_change='append_new_columns',
    tags=['aero','strategy','delta_p']
) }}

with stg_laps as (
    select
        session_id,
        driver_id,
        lap_number,
        sector1_ms,
        sector2_ms,
        sector3_ms,
        tire_compound,
        tire_temp_avg,
        fuel_kg,
        is_valid
    from {{ ref('stg_laps') }}
    where is_valid = true
),

int_delta_p as (
    select
        session_id,
        driver_id,
        rival_id,
        lap_number,
        sector,
        delta_ms
    from {{ ref('int_delta_p') }}
    where channel_key is null
),

rival_sectors as (
    select
        l.session_id,
        l.driver_id      as rival_id,
        l.lap_number,
        l.sector1_ms,
        l.sector2_ms,
        l.sector3_ms,
        l.tire_compound  as rival_compound
    from stg_laps l
),

joined as (
    select
        d.session_id,
        d.driver_id,
        d.rival_id,
        d.lap_number,
        d.sector,
        d.delta_ms,
        case d.sector
            when 1 then l.sector1_ms
            when 2 then l.sector2_ms
            when 3 then l.sector3_ms
        end as our_sector_ms,
        case d.sector
            when 1 then r.sector1_ms
            when 2 then r.sector2_ms
            when 3 then r.sector3_ms
        end as rival_sector_ms,
        l.tire_compound,
        l.tire_temp_avg,
        l.fuel_kg,
        r.rival_compound
    from int_delta_p d
    join stg_laps l
      on l.session_id = d.session_id
     and l.driver_id  = d.driver_id
     and l.lap_number = d.lap_number
    join rival_sectors r
      on r.session_id  = d.session_id
     and r.rival_id   = d.rival_id
     and r.lap_number = d.lap_number
)

select
    session_id,
    driver_id,
    rival_id,
    lap_number,
    sector,
    our_sector_ms,
    rival_sector_ms,
    delta_ms,
    tire_compound,
    rival_compound,
    tire_temp_avg,
    fuel_kg,
    delta_ms / nullif(our_sector_ms, 0) as delta_pct,
    case
        when delta_ms < 0   then 'ahead'
        when delta_ms < 50  then 'on-pace'
        when delta_ms < 200 then 'slightly-behind'
        else 'behind'
    end as delta_bucket,
    current_timestamp() as dbt_loaded_at
from joined

{% if is_incremental() %}
where session_id not in (
    select distinct session_id from {{ this }}
)
{% endif %}
`

const PIPELINE_ARTIFACTS: PipelineArtifact[] = [
  { filename: '.github/workflows/ci-cd.yml', type: 'YAML', content: CI_CD_YAML },
  { filename: 'k8s/telemetry-ingest.yaml', type: 'K8s manifest', content: K8S_TELEMETRY_INGEST_YAML },
  { filename: 'k8s/spark-streaming.yaml', type: 'K8s manifest', content: K8S_SPARK_STREAMING_YAML },
  { filename: 'k8s/hpa-telemetry.yaml', type: 'K8s manifest', content: K8S_HPA_TELEMETRY_YAML },
  { filename: 'dbt/models/fct_delta_p_sector.sql', type: 'dbt SQL', content: DBT_FCT_DELTA_P_SECTOR_SQL },
]

const artifactTypeStyle: Record<PipelineArtifact['type'], string> = {
  YAML: 'border-red-500/40 bg-red-500/10 text-red-300',
  'K8s manifest': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  'dbt SQL': 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
}

function PipelineArtifactCard({ artifact }: { artifact: PipelineArtifact }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content)
      toast.success(`Copied ${artifact.filename}`, {
        description: `${artifact.content.split('\n').length} lines · ${artifact.content.length} chars`,
      })
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard unavailable in this context')
    }
  }

  const handleDownload = () => {
    try {
      const isSql = artifact.filename.endsWith('.sql')
      const blob = new Blob([artifact.content], {
        type: isSql ? 'text/plain' : 'text/yaml',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = artifact.filename.split('/').pop() ?? 'artifact.yaml'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${a.download}`)
    } catch {
      toast.error('Download failed — see browser console')
    }
  }

  const lineCount = artifact.content.split('\n').length

  return (
    <div className="flex flex-col rounded-lg border border-border/50 bg-background/30 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-background/40 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="font-mono-nums text-[11px] text-foreground truncate">
            {artifact.filename}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'font-mono-nums text-[9px] px-1.5 py-0 h-4 shrink-0',
            artifactTypeStyle[artifact.type],
          )}
        >
          {artifact.type}
        </Badge>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/30 bg-background/20">
        <span className="text-[9px] font-mono-nums text-muted-foreground uppercase tracking-wider">
          {lineCount} lines · {artifact.content.length} bytes
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] border-border/60 bg-background/40 hover:bg-background/70"
            onClick={handleCopy}
          >
            {copied ? (
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] border-border/60 bg-background/40 hover:bg-background/70"
            onClick={handleDownload}
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Code body */}
      <pre className="text-[11px] font-mono-nums overflow-x-auto max-h-[280px] bg-background/60 rounded-md p-3 border-l-2 border-red-500/40 text-zinc-200 leading-relaxed">
        <code>{artifact.content}</code>
      </pre>
    </div>
  )
}

function PipelineArtifactsCard() {
  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur p-4">
      <SectionHeader
        title="Pipeline Artifacts"
        subtitle="GitHub Actions workflow + Kubernetes manifests (read-only)"
        right={
          <Badge
            variant="outline"
            className="border-red-500/40 bg-red-500/10 text-red-300 font-mono-nums"
          >
            <Terminal className="h-3 w-3 mr-1" />
            {PIPELINE_ARTIFACTS.length} artifacts
          </Badge>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PIPELINE_ARTIFACTS.map((a) => (
          <PipelineArtifactCard key={a.filename} artifact={a} />
        ))}
      </div>
      <Separator className="my-3 bg-border/50" />
      <div className="flex items-center gap-2 text-[10px] font-mono-nums text-muted-foreground">
        <Box className="h-3 w-3" />
        <span>
          Manifests are templated and rendered by Helm → applied via GitHub Actions
          (OIDC, race-edge cluster). Commit SHA tags pinned at deploy time.
        </span>
      </div>
    </Card>
  )
}

