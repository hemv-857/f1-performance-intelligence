'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Settings, Bell, Volume2, Monitor, Trash2, CheckCircle2, Bot, Eye,
  AlertTriangle, Info,
} from 'lucide-react'

interface SettingsState {
  soundEnabled: boolean
  desktopEnabled: boolean
  aiAutoDiagnose: boolean
  anomalyAutoTrigger: boolean
  compactDensity: boolean
  showTicker: boolean
  pulseAnomalies: boolean
}

const SETTINGS_KEY = 'rb-settings'

const DEFAULTS: SettingsState = {
  soundEnabled: true,
  desktopEnabled: false,
  aiAutoDiagnose: true,
  anomalyAutoTrigger: true,
  compactDensity: false,
  showTicker: true,
  pulseAnomalies: true,
}

function loadSettings(): SettingsState {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
  } catch { return DEFAULTS }
}

function saveSettings(s: SettingsState) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// Module-level singleton so any component can read the current settings
export const settingsStore = {
  state: DEFAULTS as SettingsState,
  listeners: [] as (() => void)[],
  init() {
    if (typeof window === 'undefined') return
    this.state = loadSettings()
  },
  update(patch: Partial<SettingsState>) {
    this.state = { ...this.state, ...patch }
    saveSettings(this.state)
    for (const l of this.listeners) l()
  },
  subscribe(l: () => void) {
    this.listeners.push(l)
    return () => {
      const i = this.listeners.indexOf(l)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  },
}

settingsStore.init()

export function useSettings() {
  const [s, setS] = useState<SettingsState>(settingsStore.state)
  useEffect(() => {
    const unsub = settingsStore.subscribe(() => setS({ ...settingsStore.state }))
    return unsub
  }, [])
  return s
}

export function updateSettings(patch: Partial<SettingsState>) {
  settingsStore.update(patch)
}

export function DataExportSettingsDrawer() {
  const [open, setOpen] = useState(false)
  const s = useSettings()
  const [desktopPerm, setDesktopPerm] = useState<string>('unsupported')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setTimeout(() => setDesktopPerm('unsupported'), 0)
      return
    }
    setTimeout(() => setDesktopPerm(Notification.permission), 0)
  }, [open])

  const toggle = (key: keyof SettingsState, value: boolean) => {
    updateSettings({ [key]: value })
  }

  const requestDesktop = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const result = await Notification.requestPermission()
    setDesktopPerm(result)
    if (result === 'granted') {
      updateSettings({ desktopEnabled: true })
      try {
        new Notification('✅ Desktop alerts enabled', { body: 'Critical anomalies will now appear as desktop notifications.' })
      } catch { /* ignore */ }
    }
  }

  const clearNotifications = () => {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem('rb-notifications') } catch { /* ignore */ }
    }
  }

  const clearAiConversation = () => {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem('rb-ai-conversation') } catch { /* ignore */ }
    }
  }

  const clearAllCache = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('rb-notifications')
        localStorage.removeItem('rb-ai-conversation')
        localStorage.removeItem('rb-settings')
        localStorage.removeItem('rb-cmdk-recent')
      } catch { /* ignore */ }
    }
    updateSettings(DEFAULTS)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Settings"
          aria-label="Open settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 border-l-border/60 bg-background/95 backdrop-blur-xl flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border/60 bg-card/60">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-zinc-500 to-zinc-700 flex items-center justify-center">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div>Settings</div>
              <div className="text-[10px] text-muted-foreground font-mono-nums font-normal">Platform preferences</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Notifications */}
            <section>
              <div className="flex items-center gap-1.5 mb-3 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold">
                <Bell className="h-3.5 w-3.5" /> Notifications
              </div>
              <div className="space-y-3">
                <SettingRow
                  icon={<Volume2 className="h-4 w-4" />}
                  title="Sound cues"
                  desc="Play a sound on critical alerts"
                  checked={s.soundEnabled}
                  onToggle={(v) => toggle('soundEnabled', v)}
                />
                <SettingRow
                  icon={<Monitor className="h-4 w-4" />}
                  title="Desktop push notifications"
                  desc={desktopPerm === 'granted' ? 'Enabled — alerts appear on your desktop' : desktopPerm === 'denied' ? 'Blocked by browser — adjust in browser settings' : 'Get critical anomalies as desktop notifications'}
                  checked={s.desktopEnabled && desktopPerm === 'granted'}
                  disabled={desktopPerm === 'denied' || desktopPerm === 'unsupported'}
                  onToggle={(v) => { if (v) requestDesktop(); else updateSettings({ desktopEnabled: false }) }}
                  badge={desktopPerm === 'granted' ? '✓ ENABLED' : desktopPerm === 'denied' ? 'BLOCKED' : desktopPerm === 'unsupported' ? 'N/A' : undefined}
                />
              </div>
            </section>

            <Separator />

            {/* AI Engineer */}
            <section>
              <div className="flex items-center gap-1.5 mb-3 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold">
                <Bot className="h-3.5 w-3.5" /> AI Race Engineer
              </div>
              <div className="space-y-3">
                <SettingRow
                  icon={<Bot className="h-4 w-4" />}
                  title="Auto-diagnose anomalies"
                  desc="Automatically ask the AI when a channel goes out of range"
                  checked={s.aiAutoDiagnose}
                  onToggle={(v) => toggle('aiAutoDiagnose', v)}
                />
                <SettingRow
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Auto-trigger on anomalies"
                  desc="Push notifications + open AI panel on new anomalies"
                  checked={s.anomalyAutoTrigger}
                  onToggle={(v) => toggle('anomalyAutoTrigger', v)}
                />
              </div>
            </section>

            <Separator />

            {/* Display */}
            <section>
              <div className="flex items-center gap-1.5 mb-3 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold">
                <Eye className="h-3.5 w-3.5" /> Display
              </div>
              <div className="space-y-3">
                <SettingRow
                  icon={<Eye className="h-4 w-4" />}
                  title="Compact density"
                  desc="Tighter spacing and smaller text"
                  checked={s.compactDensity}
                  onToggle={(v) => toggle('compactDensity', v)}
                />
                <SettingRow
                  icon={<Monitor className="h-4 w-4" />}
                  title="Live ticker tape"
                  desc="Scrolling status bar at the top of Overview"
                  checked={s.showTicker}
                  onToggle={(v) => toggle('showTicker', v)}
                />
                <SettingRow
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Pulse anomaly cards"
                  desc="Red pulse animation on out-of-range channels"
                  checked={s.pulseAnomalies}
                  onToggle={(v) => toggle('pulseAnomalies', v)}
                />
              </div>
            </section>

            <Separator />

            {/* Data & cache */}
            <section>
              <div className="flex items-center gap-1.5 mb-3 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums font-semibold">
                <Trash2 className="h-3.5 w-3.5" /> Data & Cache
              </div>
              <div className="space-y-2">
                <button
                  onClick={clearNotifications}
                  className="w-full flex items-center justify-between rounded-md border border-border/50 bg-background/40 p-2.5 text-left hover:border-red-500/40 transition-colors"
                >
                  <div>
                    <div className="text-xs font-medium">Clear notification history</div>
                    <div className="text-[10px] text-muted-foreground">Remove all stored notifications</div>
                  </div>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={clearAiConversation}
                  className="w-full flex items-center justify-between rounded-md border border-border/50 bg-background/40 p-2.5 text-left hover:border-red-500/40 transition-colors"
                >
                  <div>
                    <div className="text-xs font-medium">Clear AI conversation</div>
                    <div className="text-[10px] text-muted-foreground">Reset the AI Race Engineer chat history</div>
                  </div>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={clearAllCache}
                  className="w-full flex items-center justify-between rounded-md border border-red-500/30 bg-red-500/5 p-2.5 text-left hover:border-red-500/60 transition-colors"
                >
                  <div>
                    <div className="text-xs font-medium text-red-300">Clear all cache & reset settings</div>
                    <div className="text-[10px] text-muted-foreground">Notifications, AI history, settings, command palette history</div>
                  </div>
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            </section>

            <Separator />

            {/* About */}
            <section>
              <div className="text-[10px] text-muted-foreground font-mono-nums space-y-1">
                <div className="flex justify-between"><span>Platform version</span><span className="text-foreground">v2.4.1</span></div>
                <div className="flex justify-between"><span>Build</span><span className="text-foreground">round-9</span></div>
                <div className="flex justify-between"><span>WebSocket</span><span className="text-emerald-400">connected</span></div>
                <div className="flex justify-between"><span>Pipeline</span><span className="text-emerald-400">99.97% uptime</span></div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function SettingRow({
  icon, title, desc, checked, onToggle, disabled, badge,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  checked: boolean
  onToggle: (v: boolean) => void
  disabled?: boolean
  badge?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-md border border-border/50 bg-background/40 p-2.5', disabled && 'opacity-50')}>
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{title}</span>
          {badge && <Badge variant="outline" className="text-[9px] font-mono-nums">{badge}</Badge>}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
    </div>
  )
}
