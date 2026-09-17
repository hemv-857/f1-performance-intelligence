'use client'

import { useEffect } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import type { ViewKey } from '@/lib/types'
import {
  LayoutDashboard, Gauge, Boxes, Activity, Workflow, ShieldAlert, Radio, GitBranch,
  Sparkles, FileText, Play, Zap, RotateCcw, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { key: ViewKey; label: string; icon: any; desc: string }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'Race weekend status & KPIs' },
  { key: 'telemetry', label: 'Telemetry Viewer', icon: Gauge, desc: 'Live channels · lap overlay · diff' },
  { key: 'builder', label: 'Low-Code Builder', icon: Boxes, desc: 'Drag/drop SQL → viz' },
  { key: 'analytics', label: 'Analytics (dbt)', icon: Activity, desc: 'Delta-P · deg · fuel · head-to-head · constructors' },
  { key: 'devops', label: 'DevOps', icon: Workflow, desc: 'CI/CD · canary · rollback' },
  { key: 'raceops', label: 'Race Ops', icon: ShieldAlert, desc: 'Health · monitoring · playbook · weather' },
  { key: 'pitbox', label: 'Pit-Box (mobile)', icon: Radio, desc: 'Strategist mobile view' },
  { key: 'strategy', label: 'Strategy', icon: GitBranch, desc: 'Pit windows · tire-age · stint planner' },
]

const ACTIONS = [
  { id: 'ai', label: 'Ask AI Race Engineer', icon: Sparkles, desc: 'Open the AI assistant', action: 'ai' },
  { id: 'simulate', label: 'Simulate telemetry anomaly', icon: Zap, desc: 'Inject an anomaly for demo', action: 'simulate', view: 'telemetry' as ViewKey },
  { id: 'playback', label: 'Open lap playback', icon: Play, desc: 'Replay a lap frame-by-frame', action: 'navigate', view: 'telemetry' as ViewKey },
  { id: 'export', label: 'Export PDF report', icon: FileText, desc: 'Generate a performance report', action: 'navigate', view: 'telemetry' as ViewKey },
  { id: 'health', label: 'Run synthetic race simulation', icon: RotateCcw, desc: 'Pre-race health check', action: 'navigate', view: 'raceops' as ViewKey },
]

export function CommandPalette() {
  const { cmdKOpen, setCmdKOpen, setActiveView, setAiPanelOpen } = useAppStore()

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdKOpen(!cmdKOpen)
      }
      if (e.key === 'Escape') setCmdKOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cmdKOpen, setCmdKOpen])

  const runNav = (key: ViewKey) => {
    setActiveView(key)
    setCmdKOpen(false)
  }

  const runAction = (a: typeof ACTIONS[number]) => {
    if (a.action === 'ai') {
      setAiPanelOpen(true)
    } else if (a.action === 'navigate' && a.view) {
      setActiveView(a.view)
    } else if (a.action === 'simulate' && a.view) {
      setActiveView(a.view)
    }
    setCmdKOpen(false)
  }

  return (
    <Dialog open={cmdKOpen} onOpenChange={setCmdKOpen}>
      <DialogContent className="max-w-[560px] p-0 border-border/60 bg-card/95 backdrop-blur-xl" showCloseButton={false}>
        <Command className="rounded-lg">
          <div className="flex items-center gap-2 px-3 border-b border-border/60">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <CommandInput placeholder="Search views, actions, or type a command…" className="h-11 border-0 focus:ring-0 text-sm" />
            <kbd className="text-[9px] text-muted-foreground font-mono-nums border border-border/60 rounded px-1 py-0.5">ESC</kbd>
          </div>
          <CommandList className="max-h-[360px] overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No results found.</CommandEmpty>
            <CommandGroup heading="Navigate to view" className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.key}
                    value={`${item.label} ${item.desc} view nav`}
                    onSelect={() => runNav(item.key)}
                    className="aria-selected:bg-red-500/10 aria-selected:text-red-300"
                  >
                    <Icon className="h-4 w-4 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{item.desc}</div>
                    </div>
                    <kbd className="text-[9px] text-muted-foreground font-mono-nums border border-border/60 rounded px-1 py-0.5">↵</kbd>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Quick actions" className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
              {ACTIONS.map((a) => {
                const Icon = a.icon
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.label} ${a.desc} action`}
                    onSelect={() => runAction(a)}
                    className="aria-selected:bg-amber-500/10 aria-selected:text-amber-300"
                  >
                    <Icon className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{a.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{a.desc}</div>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Shortcuts" className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">
              <div className="px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground font-mono-nums flex-wrap">
                <span className="flex items-center gap-1"><kbd className="border border-border/60 rounded px-1 py-0.5">⌘K</kbd> open palette</span>
                <span className="flex items-center gap-1"><kbd className="border border-border/60 rounded px-1 py-0.5">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="border border-border/60 rounded px-1 py-0.5">↵</kbd> select</span>
                <span className="flex items-center gap-1"><kbd className="border border-border/60 rounded px-1 py-0.5">ESC</kbd> close</span>
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
