'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  HelpCircle,
  Keyboard,
  Code2,
  GitBranch,
  Lightbulb,
  LayoutDashboard,
  Gauge,
  Boxes,
  Activity,
  Workflow,
  ShieldAlert,
  Radio,
  CircleDot,
  type LucideIcon,
} from 'lucide-react'

// ------------------------------------------------------------------
// Static content definitions
// ------------------------------------------------------------------

interface ViewRow {
  key: string
  label: string
  desc: string
  icon: LucideIcon
}

const VIEWS: ViewRow[] = [
  { key: 'overview', label: 'Overview', desc: 'Race weekend status, KPIs & live ticker.', icon: LayoutDashboard },
  { key: 'telemetry', label: 'Telemetry Viewer', desc: 'Live channels, lap overlay & per-corner diff.', icon: Gauge },
  { key: 'builder', label: 'Low-Code Builder', desc: 'Drag-and-drop SQL → viz dashboards.', icon: Boxes },
  { key: 'analytics', label: 'Analytics (dbt)', desc: 'Delta-P, tire degradation & fuel models.', icon: Activity },
  { key: 'devops', label: 'DevOps', desc: 'CI/CD pipelines, canary releases & rollback.', icon: Workflow },
  { key: 'raceops', label: 'Race Ops', desc: 'Health checks, monitoring & incident playbooks.', icon: ShieldAlert },
  { key: 'pitbox', label: 'Pit-Box', desc: 'Strategist mobile view, iPad-optimized.', icon: Radio },
  { key: 'strategy', label: 'Strategy', desc: 'Pit windows, tire-age & stint planner.', icon: GitBranch },
]

const KEY_METRICS: { label: string; value: string }[] = [
  { label: 'Uptime', value: '99.9%' },
  { label: 'Query latency', value: '< 2s' },
  { label: 'Telemetry channels', value: '100+' },
  { label: 'Sample rate', value: '1 kHz' },
  { label: 'Microservices', value: '8' },
]

interface ShortcutRow {
  keys: string[] // each entry rendered as its own <kbd>
  label: string
}

const NAV_SHORTCUTS: ShortcutRow[] = [
  { keys: ['g', 'o'], label: 'Overview' },
  { keys: ['g', 't'], label: 'Telemetry Viewer' },
  { keys: ['g', 'b'], label: 'Low-Code Builder' },
  { keys: ['g', 'a'], label: 'Analytics' },
  { keys: ['g', 'd'], label: 'DevOps' },
  { keys: ['g', 'r'], label: 'Race Ops' },
  { keys: ['g', 'p'], label: 'Pit-Box' },
  { keys: ['g', 's'], label: 'Strategy' },
]

const GLOBAL_SHORTCUTS: ShortcutRow[] = [
  { keys: ['⌘', 'K'], label: 'Command palette' },
  { keys: ['?'], label: 'This help dialog' },
  { keys: ['Esc'], label: 'Close dialog / panel' },
]

interface FaqPair {
  q: string
  a: string
}

const FAQS: FaqPair[] = [
  {
    q: 'How do I overlay two drivers’ laps?',
    a: 'Go to Telemetry Viewer → Lap Overlay & Diff mode. Pick our lap (A) and the rival lap (B), select a channel, and see the trace overlay with problem-zone highlighting.',
  },
  {
    q: 'How does the AI Race Engineer work?',
    a: 'The AI has live access to your alerts, session laps, delta-P, and channel diffs. Ask it anything, or let it auto-diagnose anomalies — when a channel goes out of range, it automatically opens and analyzes the root cause.',
  },
  {
    q: 'How do I export data?',
    a: 'Click the Export button in the header. Choose CSV or JSON, pick a dataset (laps, deltas, deployments, audit log, etc.), and download.',
  },
  {
    q: 'How do I generate a PDF report?',
    a: 'In the Telemetry Viewer overlay mode, click ‘Export PDF’. A 2-page vector PDF with driver comparison, delta-P, problem zones, and recommendations will be generated.',
  },
  {
    q: 'How do I share a view with a colleague?',
    a: 'Click the Share button in the header — the current view + session URL is copied to your clipboard.',
  },
  {
    q: 'Can I use this on mobile?',
    a: 'Yes — the Pit-Box view is optimized for iPad with large touch targets. The rest of the platform is responsive.',
  },
]

interface ApiEndpoint {
  method: 'GET' | 'POST'
  path: string
  desc: string
}

interface ApiGroup {
  name: string
  endpoints: ApiEndpoint[]
}

const API_GROUPS: ApiGroup[] = [
  {
    name: 'Sessions',
    endpoints: [
      { method: 'GET', path: '/api/sessions', desc: 'List all race-weekend sessions.' },
      { method: 'GET', path: '/api/sessions/[id]', desc: 'Get a single session with circuit + laps.' },
    ],
  },
  {
    name: 'Telemetry',
    endpoints: [
      { method: 'GET', path: '/api/telemetry/lap/[id]', desc: 'Channel samples for a single lap.' },
      { method: 'GET', path: '/api/telemetry/compare', desc: 'Per-corner delta between two laps.' },
    ],
  },
  {
    name: 'Analytics',
    endpoints: [
      { method: 'GET', path: '/api/analytics/delta', desc: 'Delta-P (performance gap) per driver.' },
      { method: 'GET', path: '/api/analytics/degradation', desc: 'Tire degradation curves per compound.' },
      { method: 'GET', path: '/api/analytics/fuel', desc: 'Fuel burn & lift-and-coast projection.' },
    ],
  },
  {
    name: 'DevOps',
    endpoints: [
      { method: 'GET', path: '/api/devops/deployments', desc: 'Recent CI/CD deployments & canary %.' },
      { method: 'POST', path: '/api/devops/deployments', desc: 'Trigger a new deployment.' },
      { method: 'GET', path: '/api/devops/alerts', desc: 'Active platform alerts & severity.' },
      { method: 'GET', path: '/api/devops/incidents', desc: 'P1/P2 incidents & playbook steps.' },
      { method: 'GET', path: '/api/devops/health', desc: 'Pipeline health, lag & uptime snapshot.' },
    ],
  },
  {
    name: 'Platform',
    endpoints: [
      { method: 'GET', path: '/api/leaderboard', desc: 'Engineer leaderboard (points & W-D-L).' },
      { method: 'GET', path: '/api/audit-log', desc: 'Audit log entries (action, actor, ts).' },
      { method: 'POST', path: '/api/audit-log', desc: 'Write a new audit-log entry.' },
      { method: 'POST', path: '/api/ai-engineer', desc: 'Send a message to the AI Race Engineer.' },
      { method: 'GET', path: '/api/templates', desc: 'List Low-Code Builder templates.' },
      { method: 'POST', path: '/api/templates/run', desc: 'Execute a builder template query.' },
      { method: 'GET', path: '/api/reports/aero', desc: 'Aero performance report payload.' },
      { method: 'GET', path: '/api/reports/chassis', desc: 'Chassis setup report payload.' },
      { method: 'GET', path: '/api/reports/pdf/[sessionId]', desc: 'Generate a 2-page PDF report.' },
    ],
  },
]

interface ChangelogEntry {
  version: string
  round: string
  date: string
  features: string[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v2.4.1',
    round: 'round 11',
    date: '2026-09-15',
    features: [
      'Settings wired to UI — toggle ticker, pulse, and compact density in real time.',
      'Onboarding tour — 5-step first-visit walkthrough with retake option.',
      'Share URL deep-linking — current view + session encoded in the URL hash.',
    ],
  },
  {
    version: 'v2.4.0',
    round: 'round 8',
    date: '2026-08-22',
    features: [
      'Engineer Leaderboard — points, W-D-L, podiums across the team.',
      'Session Comparison mode — diff two sessions side-by-side (FP2 vs Q).',
      'Notification persistence + desktop push (Notification API).',
    ],
  },
  {
    version: 'v2.3.9',
    round: 'round 7',
    date: '2026-08-08',
    features: [
      'Keyboard shortcuts — g+key navigation (à la GitHub).',
      'Notification Center — severity-bucketed, persistent dropdown.',
      'Deep-Dive track delta map — per-corner colored delta dots.',
    ],
  },
  {
    version: 'v2.3.8',
    round: 'round 6',
    date: '2026-07-19',
    features: [
      'Animated number tickers — count-up on KPI cards.',
      'Page transitions — Framer Motion view enter/exit.',
      'Skeleton loaders — shadcn Skeleton for async views.',
      'Driver Deep-Dive tab — per-driver radar + corner deltas.',
    ],
  },
  {
    version: 'v2.3.7',
    round: 'round 5',
    date: '2026-06-30',
    features: [
      'Audit Log — every user action is recorded server-side.',
      'Simulate Anomaly — DevOps tool to inject out-of-range channels.',
      'AI persistence — chat history saved to localStorage.',
      'Weather forecast panel — air/track temp + rain probability.',
      'Command Palette — ⌘K search across views & actions.',
    ],
  },
]

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function KbdBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.4rem] px-1.5 py-0.5 text-[10px] font-mono-nums font-medium border border-border/60 rounded bg-background/60 text-foreground/90">
      {children}
    </kbd>
  )
}

function ShortcutRow({ keys, label }: ShortcutRow) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-accent/40 transition-colors">
      <span className="text-xs text-foreground">{label}</span>
      <span className="flex gap-1 shrink-0">
        {keys.map((k, i) => (
          <KbdBadge key={i}>{k}</KbdBadge>
        ))}
      </span>
    </div>
  )
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono-nums text-[9px] font-bold px-1.5',
        method === 'GET'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      )}
    >
      {method}
    </Badge>
  )
}

function ApiEndpointRow({ ep }: { ep: ApiEndpoint }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/60 p-2">
      <div className="flex items-center gap-2 mb-1">
        <MethodBadge method={ep.method} />
        <code className="text-[11px] font-mono-nums text-foreground/90 truncate">{ep.path}</code>
      </div>
      <div className="text-[10px] text-muted-foreground leading-snug pl-1">{ep.desc}</div>
    </div>
  )
}

// ------------------------------------------------------------------
// Tab content blocks
// ------------------------------------------------------------------

function OverviewTab() {
  return (
    <div className="space-y-5 pt-3">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-base font-semibold tracking-tight">Racing Bulls Performance Intelligence Platform</h2>
        </div>
        <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 bg-red-500/10 text-red-300">
          v2.4.1 · round-11
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        A unified engineering workstation covering the full race-weekend loop — live{' '}
        <span className="text-foreground font-medium">1 kHz telemetry</span> ingestion (Kafka + Spark),
        a unified <span className="text-foreground font-medium">Telemetry Viewer</span> with lap overlay & diff,
        a <span className="text-foreground font-medium">Low-Code Builder</span> for ad-hoc SQL → viz,
        dbt-style <span className="text-foreground font-medium">Analytics</span> models (delta-P, deg, fuel),
        full <span className="text-foreground font-medium">DevOps</span> CI/CD observability,
        <span className="text-foreground font-medium">Race Ops</span> incident playbooks,
        an iPad-friendly <span className="text-foreground font-medium">Pit-Box</span>,
        a <span className="text-foreground font-medium">Strategy</span> stint planner,
        and a proactive <span className="text-foreground font-medium">AI Race Engineer</span> that
        auto-diagnoses anomalies the moment a channel goes out of range.
      </p>

      <Separator />

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold mb-2">
          The 8 views
        </div>
        <div className="space-y-1.5">
          {VIEWS.map((v) => {
            const Icon = v.icon
            return (
              <div
                key={v.key}
                className="flex items-start gap-2.5 rounded-md border border-border/50 bg-card/60 px-2.5 py-2"
              >
                <Icon className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium leading-tight">{v.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{v.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Separator />

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold mb-2">
          Key metrics
        </div>
        <div className="rounded-md border border-border/50 bg-background/60 overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {KEY_METRICS.map((m, i) => (
                <tr
                  key={m.label}
                  className={cn(i > 0 && 'border-t border-border/40')}
                >
                  <td className="px-3 py-1.5 text-muted-foreground">{m.label}</td>
                  <td className="px-3 py-1.5 text-right font-mono-nums font-medium text-foreground">{m.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ShortcutsTab() {
  return (
    <div className="space-y-5 pt-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold mb-2">
          View navigation — press <KbdBadge>g</KbdBadge> then key
        </div>
        <div className="space-y-0.5">
          {NAV_SHORTCUTS.map((s) => (
            <ShortcutRow key={s.label} keys={s.keys} label={s.label} />
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold mb-2">
          Global
        </div>
        <div className="space-y-0.5">
          {GLOBAL_SHORTCUTS.map((s) => (
            <ShortcutRow key={s.label} keys={s.keys} label={s.label} />
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border/50 bg-card/60 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
        <Lightbulb className="inline h-3.5 w-3.5 text-amber-400 mr-1.5 -mt-0.5" />
        Press <KbdBadge>?</KbdBadge> any time to see the in-app shortcuts help dialog.
      </div>
    </div>
  )
}

function FaqTab() {
  return (
    <div className="space-y-3 pt-3">
      {FAQS.map((f, i) => (
        <div key={i}>
          <div className="rounded-md border border-border/50 bg-card/60 px-3 py-2.5">
            <div className="flex items-start gap-2 mb-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <div className="text-xs font-medium leading-snug">{f.q}</div>
            </div>
            <div className="text-[11px] text-muted-foreground leading-relaxed pl-5.5">
              {f.a}
            </div>
          </div>
          {i < FAQS.length - 1 && <div className="h-1.5" />}
        </div>
      ))}
    </div>
  )
}

function ApiTab() {
  return (
    <div className="space-y-5 pt-3">
      {API_GROUPS.map((g) => (
        <div key={g.name}>
          <div className="flex items-center gap-1.5 mb-2">
            <Code2 className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold">
              {g.name}
            </span>
            <Badge variant="outline" className="text-[9px] font-mono-nums ml-auto">
              {g.endpoints.length}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {g.endpoints.map((ep) => (
              <ApiEndpointRow key={`${ep.method} ${ep.path}`} ep={ep} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChangelogTab() {
  return (
    <div className="space-y-4 pt-3">
      {CHANGELOG.map((entry) => (
        <div key={entry.version} className="relative pl-4">
          {/* vertical timeline line */}
          <span className="absolute left-[5px] top-2 bottom-[-1rem] w-px bg-border/60" />
          <span className="absolute left-[2px] top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />

          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="outline" className="font-mono-nums text-[10px] border-red-500/40 bg-red-500/10 text-red-300">
              {entry.version}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono-nums">{entry.round}</span>
            <span className="text-[10px] text-muted-foreground font-mono-nums">· {entry.date}</span>
          </div>
          <ul className="space-y-1">
            {entry.features.map((feat, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                <CircleDot className="h-2.5 w-2.5 text-red-400/70 mt-1 shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------
// Drawer
// ------------------------------------------------------------------

export function HelpDrawer() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('overview')

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground font-mono-nums text-xs"
          title="Help & Documentation"
          aria-label="Open Help & Documentation center"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Help</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] p-0 border-l-border/60 bg-background/95 backdrop-blur-xl flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/60 bg-card/60">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-[0_0_12px_rgba(248,113,113,0.4)]">
              <HelpCircle className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div>Help &amp; Documentation</div>
              <div className="text-[10px] text-muted-foreground font-mono-nums font-normal">
                Platform guide · shortcuts · API · changelog
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex-1 flex flex-col min-h-0 gap-0"
        >
          {/* Scrollable tab list on mobile */}
          <div className="px-2 pt-2 border-b border-border/60 bg-card/40">
            <TabsList className="w-full justify-start overflow-x-auto h-9 bg-background/60 rounded-md">
              <TabsTrigger value="overview" className="gap-1 text-xs">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="shortcuts" className="gap-1 text-xs">
                <Keyboard className="h-3.5 w-3.5" />
                Shortcuts
              </TabsTrigger>
              <TabsTrigger value="faq" className="gap-1 text-xs">
                <HelpCircle className="h-3.5 w-3.5" />
                FAQ
              </TabsTrigger>
              <TabsTrigger value="api" className="gap-1 text-xs">
                <Code2 className="h-3.5 w-3.5" />
                API
              </TabsTrigger>
              <TabsTrigger value="changelog" className="gap-1 text-xs">
                <GitBranch className="h-3.5 w-3.5" />
                What's New
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 pb-6">
              <TabsContent value="overview" className="mt-0">
                <OverviewTab />
              </TabsContent>
              <TabsContent value="shortcuts" className="mt-0">
                <ShortcutsTab />
              </TabsContent>
              <TabsContent value="faq" className="mt-0">
                <FaqTab />
              </TabsContent>
              <TabsContent value="api" className="mt-0">
                <ApiTab />
              </TabsContent>
              <TabsContent value="changelog" className="mt-0">
                <ChangelogTab />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        <div className="border-t border-border/60 px-4 py-2.5 bg-card/40 text-center">
          <div className="text-[10px] text-muted-foreground font-mono-nums">
            Press <KbdBadge>?</KbdBadge> any time for shortcuts · v2.4.1
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
