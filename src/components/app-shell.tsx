'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket'
import { OverviewView } from '@/components/views/overview'
import { TelemetryViewer } from '@/components/views/telemetry-viewer'
import { BuilderView } from '@/components/views/builder'
import { AnalyticsView } from '@/components/views/analytics'
import { DevOpsView } from '@/components/views/devops'
import { RaceOpsView } from '@/components/views/race-ops'
import {
  Activity,
  Gauge,
  LayoutDashboard,
  Boxes,
  Workflow,
  ShieldAlert,
  Radio,
  CircleDot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Toaster as SonnerToaster } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import type { SessionSummary } from '@/lib/types'

const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'Race weekend status & KPIs' },
  { key: 'telemetry', label: 'Telemetry Viewer', icon: Gauge, desc: 'Live channels · lap overlay · diff' },
  { key: 'builder', label: 'Low-Code Builder', icon: Boxes, desc: 'Drag/drop SQL → viz' },
  { key: 'analytics', label: 'Analytics (dbt)', icon: Activity, desc: 'Delta-P · deg · fuel' },
  { key: 'devops', label: 'DevOps', icon: Workflow, desc: 'CI/CD · canary · rollback' },
  { key: 'raceops', label: 'Race Ops', icon: ShieldAlert, desc: 'Health · monitoring · playbook' },
] as const

export function AppShell() {
  const { activeView, setActiveView, sessions, setSessions, setSelectedSessionId, setSidebarOpen, sidebarOpen } = useAppStore()
  const socket = useTelemetrySocket()

  // load sessions once
  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const r = await fetch('/api/sessions')
      const j = await r.json()
      return j.sessions as SessionSummary[]
    },
  })

  useEffect(() => {
    if (sessionsQuery.data) {
      setSessions(sessionsQuery.data)
      // default to the live session (Singapore) qualifying, else first completed
      const live = sessionsQuery.data.find((s) => s.status === 'live')
      const completed = sessionsQuery.data.find((s) => s.status === 'completed')
      const target = live ?? completed ?? sessionsQuery.data[0]
      if (target) setSelectedSessionId(target.id)
    }
  }, [sessionsQuery.data, setSessions, setSelectedSessionId])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          {/* mobile menu */}
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 rounded-md bg-red-600 flex items-center justify-center shadow-[0_0_18px_rgba(248,113,113,0.4)]">
              <span className="font-black text-white text-sm tracking-tighter">RB</span>
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 blink" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">
                Racing Bulls <span className="text-muted-foreground font-normal">·</span> Performance Intelligence
              </div>
              <div className="hidden sm:block text-[10px] text-muted-foreground font-mono-nums">
                F1 ENGINEERING PLATFORM · v2.4.1
              </div>
            </div>
          </div>

          {/* center status (live) */}
          <div className="ml-auto hidden md:flex items-center gap-3">
            <PipelineStatus socket={socket} />
          </div>

          <div className="md:hidden ml-auto">
            <LivePill connected={socket.connected} />
          </div>

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border/60">
            <LivePill connected={socket.connected} />
            <Badge variant="outline" className="font-mono-nums text-[10px] border-emerald-500/40 text-emerald-300">
              R2 · SINGAPORE
            </Badge>
          </div>
        </div>
      </header>

      {/* ===== Body: sidebar + main ===== */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:sticky lg:top-14 top-14 left-0 z-30 w-60 shrink-0 border-r border-border/60 bg-sidebar/80 backdrop-blur-xl',
            'h-[calc(100vh-3.5rem)] overflow-y-auto',
            'transition-transform duration-200',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <nav className="p-3 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = activeView === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveView(item.key)
                    setSidebarOpen(false)
                  }}
                  className={cn(
                    'group w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'bg-red-500/15 text-foreground ring-1 ring-red-500/30'
                      : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', active ? 'text-red-400' : 'text-muted-foreground group-hover:text-foreground')} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{item.desc}</div>
                  </div>
                  {active && <CircleDot className="ml-auto h-3 w-3 text-red-400 mt-1" />}
                </button>
              )
            })}
          </nav>

          {/* live driver feed mini */}
          <div className="p-3 border-t border-border/60">
            <div className="flex items-center gap-1.5 mb-2">
              <Radio className="h-3.5 w-3.5 text-red-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Live feed</span>
            </div>
            <div className="space-y-1.5">
              {socket.drivers.slice(0, 6).map((d) => (
                <div key={d.code} className="flex items-center gap-2 text-xs">
                  <span className={cn('h-1.5 w-1.5 rounded-full', d.isRival ? 'bg-amber-400' : 'bg-red-500')} />
                  <span className="font-mono-nums font-bold w-8">{d.code}</span>
                  <span className="text-muted-foreground text-[11px]">L{d.lap}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono-nums">
                    {(socket.ticks[d.code]?.channels.speed ?? 0).toFixed(0)} km/h
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-14 z-20 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 px-3 sm:px-5 py-5 grid-bg">
          <div className="mx-auto max-w-[1500px]">
            {activeView === 'overview' && <OverviewView socket={socket} />}
            {activeView === 'telemetry' && <TelemetryViewer socket={socket} />}
            {activeView === 'builder' && <BuilderView />}
            {activeView === 'analytics' && <AnalyticsView />}
            {activeView === 'devops' && <DevOpsView />}
            {activeView === 'raceops' && <RaceOpsView socket={socket} />}
          </div>
        </main>
      </div>

      {/* ===== Footer (sticky bottom) ===== */}
      <footer className="mt-auto border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3 font-mono-nums">
            <span>Racing Bulls Performance Engineering</span>
            <span className="text-border">|</span>
            <span className="hidden sm:inline">Kafka · Spark · Snowflake · dbt · K8s · Next.js</span>
          </div>
          <div className="flex items-center gap-3 font-mono-nums">
            <span className="flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', socket.pipeline?.dataLossGuarantee ? 'bg-emerald-400' : 'bg-red-500')} />
              ZERO-DATA-LOSS GUARANTEE
            </span>
            <span className="text-border">|</span>
            <span>UPTIME {((socket.pipeline?.uptimePct ?? 99.9)).toFixed(2)}%</span>
            <span className="text-border hidden sm:inline">|</span>
            <span className="hidden sm:inline">© {new Date().getFullYear()} RB-F1-IP</span>
          </div>
        </div>
      </footer>

      {/* Sonner toasts (used by race-ops / devops playbooks) */}
      <SonnerToaster theme="dark" position="bottom-right" richColors closeButton />
    </div>
  )
}

function LivePill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono-nums font-semibold',
        connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/50 bg-red-500/10 text-red-300'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-400 blink' : 'bg-red-500')} />
      {connected ? 'WS LIVE' : 'WS DOWN'}
    </span>
  )
}

function PipelineStatus({ socket }: { socket: ReturnType<typeof useTelemetrySocket> }) {
  const p = socket.pipeline
  const healthy = p?.primaryHealthy ?? false
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono-nums">
      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card/50 px-2 py-1">
        <span className={cn('h-1.5 w-1.5 rounded-full', healthy ? 'bg-emerald-400' : 'bg-red-500 blink')} />
        <span className="text-muted-foreground">PIPELINE</span>
        <span className={healthy ? 'text-emerald-300' : 'text-red-300'}>{healthy ? 'NOMINAL' : 'FAILOVER'}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card/50 px-2 py-1">
        <span className="text-muted-foreground">LAG</span>
        <span className={cn((p?.consumerLagMs ?? 0) > 5000 ? 'text-red-300' : 'text-foreground')}>
          {((p?.consumerLagMs ?? 0) / 1000).toFixed(2)}s
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card/50 px-2 py-1">
        <span className="text-muted-foreground">INGEST</span>
        <span className="text-amber-300">{(p?.ingestRateHz ?? 0).toLocaleString()}Hz</span>
      </div>
    </div>
  )
}
