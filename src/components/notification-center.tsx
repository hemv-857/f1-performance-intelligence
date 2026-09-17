'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Bell, BellRing, AlertTriangle, CheckCircle2, Info, X, Trash2, Volume2, VolumeX,
} from 'lucide-react'

export interface Notification {
  id: string
  title: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'critical'
  source: string
  ts: number
  read: boolean
  action?: string // e.g. "ai-diagnosed", "playbook-run"
}

// Module-level event emitter so any component can push notifications.
// We avoid reassigning module-level bindings (react-hooks/globals + immutability)
// by mutating a single array in place via splice/unshift.
type Listener = (n: Notification[]) => void
const state = {
  list: [] as Notification[],
  listeners: [] as Listener[],
}

function emit() {
  for (const l of state.listeners) l(state.list)
}

export function pushNotification(n: Omit<Notification, 'id' | 'ts' | 'read'>): void {
  const full: Notification = {
    ...n,
    id: `${n.source}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    read: false,
  }
  state.list.unshift(full)
  if (state.list.length > 50) state.list.length = 50
  emit()
  // also fire a sonner toast for immediate feedback
  try {
    import('sonner').then(({ toast }) => {
      const opts = { description: n.message, duration: n.severity === 'critical' ? 8000 : 4000 }
      if (n.severity === 'critical') toast.error(n.title, opts)
      else if (n.severity === 'warning') toast.warning(n.title, opts)
      else if (n.severity === 'success') toast.success(n.title, opts)
      else toast.info(n.title, opts)
    })
  } catch { /* ignore */ }
}

export function useNotifications() {
  const [list, setList] = useState<Notification[]>(() => [...state.list])
  useEffect(() => {
    const l: Listener = (n) => {
      // schedule outside render phase to satisfy lint
      setTimeout(() => setList([...n]), 0)
    }
    state.listeners.push(l)
    // catch up if notifications arrived between init and subscribe
    if (state.list.length !== list.length) {
      setTimeout(() => setList([...state.list]), 0)
    }
    return () => {
      const i = state.listeners.indexOf(l)
      if (i >= 0) state.listeners.splice(i, 1)
    }
  }, [])
  return list
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/40', dot: 'bg-red-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/40', dot: 'bg-amber-500' },
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/40', dot: 'bg-emerald-500' },
  info: { icon: Info, color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/40', dot: 'bg-zinc-500' },
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const list = useNotifications()
  const unread = list.filter((n) => !n.read).length

  const markAllRead = () => {
    for (let i = 0; i < state.list.length; i++) state.list[i] = { ...state.list[i], read: true }
    emit()
  }

  const clearAll = () => {
    state.list.length = 0
    emit()
  }

  const remove = (id: string) => {
    const i = state.list.findIndex((n) => n.id === id)
    if (i >= 0) state.list.splice(i, 1)
    emit()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative h-8 gap-1.5 border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-red-500/40 font-mono-nums text-xs"
        >
          <Bell className={cn('h-3.5 w-3.5', unread > 0 && 'text-red-400')} />
          <span className="hidden lg:inline">Alerts</span>
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center pulse-red">
              {unread}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 border-l-border/60 bg-background/95 backdrop-blur-xl flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border/60 bg-card/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <div className="relative h-7 w-7 rounded-md bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                <BellRing className="h-4 w-4 text-white" />
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 blink" />}
              </div>
              <div className="leading-tight">
                <div>Notification Center</div>
                <div className="text-[10px] text-muted-foreground font-mono-nums font-normal">{list.length} total · {unread} unread</div>
              </div>
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSoundOn((s) => !s)} title={soundOn ? 'Sound on' : 'Sound off'}>
                {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={markAllRead} disabled={unread === 0}>
                Mark all read
              </Button>
            </div>
          </div>
        </SheetHeader>

        {list.length > 0 && (
          <div className="px-4 py-2 border-b border-border/40 bg-background/30 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums">Recent</span>
            <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:text-red-400 flex items-center gap-1 font-mono-nums">
              <Trash2 className="h-3 w-3" /> Clear all
            </button>
          </div>
        )}

        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-2">
            {list.length === 0 && (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="text-sm font-medium">All quiet</div>
                <p className="text-[11px] text-muted-foreground mt-1">No notifications. Anomalies, playbook runs, and AI diagnoses will appear here.</p>
              </div>
            )}
            {list.map((n) => {
              const cfg = SEVERITY_CONFIG[n.severity]
              const Icon = cfg.icon
              return (
                <div
                  key={n.id}
                  className={cn('rounded-lg border p-2.5 slide-up', cfg.bg, !n.read && 'ring-1 ring-red-500/20')}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', cfg.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">{n.title}</span>
                        {!n.read && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground font-mono-nums">
                        <span className="uppercase">{n.source}</span>
                        <span>·</span>
                        <span>{timeAgo(n.ts)}</span>
                        {n.action && (
                          <>
                            <span>·</span>
                            <span className="text-amber-400">{n.action}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button onClick={() => remove(n.id)} className="p-0.5 rounded hover:bg-accent text-muted-foreground shrink-0" aria-label="Dismiss">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 px-4 py-2.5 bg-card/40 text-[10px] text-muted-foreground font-mono-nums text-center">
          {soundOn ? '🔔 Sound cues on' : '🔕 Muted'} · Auto-captures anomalies, playbooks, AI diagnoses
        </div>
      </SheetContent>
    </Sheet>
  )
}
