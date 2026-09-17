'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore, logAudit } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  Bot, Send, Sparkles, Loader2, AlertCircle, X, MessageSquare, Zap, TrendingDown, GitCompare, Disc, BellRing,
} from 'lucide-react'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

const SUGGESTIONS = [
  { icon: GitCompare, label: 'Why are we slower than VER in Sector 2?', prompt: 'Why are we slower than VER in Sector 2? Analyze the sector deltas and channel diffs.' },
  { icon: TrendingDown, label: 'Analyze tire degradation on TSU\'s car', prompt: 'Analyze the tire degradation trend for TSU. Is the current compound holding up, and when should we pit?' },
  { icon: Zap, label: 'Brake temp anomaly on Turn 3?', prompt: 'Is there a brake temperature anomaly on Turn 3? The alert says FL temp is +15°C vs the rival — what\'s the root cause?' },
  { icon: Disc, label: 'Best compound for the race stint?', prompt: 'Based on the practice and qualifying data, which tire compound should we start the race on, and what\'s the optimal pit window?' },
]

export function AiEngineerPanel() {
  const { selectedSessionId, sessions, anomalies, acknowledgeAnomaly, aiPanelOpen, setAiPanelOpen } = useAppStore()
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    // Restore conversation from localStorage on mount
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem('rb-ai-conversation')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextInfo, setContextInfo] = useState<{ contextSize: number; usedSession: boolean; usedDriver: string | null } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastAutoAskedId = useRef<string | null>(null)

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('rb-ai-conversation', JSON.stringify(messages.slice(-30))) // keep last 30
    } catch { /* ignore quota errors */ }
  }, [messages])

  // auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Auto-ask the AI when a NEW anomaly arrives (dedupe by id, only the latest unacknowledged)
  const latestAnomaly = anomalies.find((a) => !a.acknowledged)
  useEffect(() => {
    if (!latestAnomaly || latestAnomaly.id === lastAutoAskedId.current) return
    if (loading) return
    lastAutoAskedId.current = latestAnomaly.id
    // auto-open the panel
    setAiPanelOpen(true)
    // auto-ask
    const prompt = `ANOMALY DETECTED: ${latestAnomaly.message}. The live value is ${latestAnomaly.value.toFixed(latestAnomaly.channel.includes('temp') || latestAnomaly.channel.includes('pressure') ? 1 : 0)}. Diagnose the likely root cause and recommend an immediate engineering action (setup change or driving adjustment) to bring it back into the safe range [${latestAnomaly.range.min}, ${latestAnomaly.range.max}].`
    send(prompt)
    acknowledgeAnomaly(latestAnomaly.id)
  }, [latestAnomaly?.id])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMsg = { role: 'user', content: text, ts: Date.now() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai-engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: selectedSessionId,
          driverCode: 'TSU',
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const reply = data.reply || data.error || 'No response.'
      setMessages((m) => [...m, { role: 'assistant', content: reply, ts: Date.now() }])
      setContextInfo({ contextSize: data.contextSize ?? 0, usedSession: data.usedSession ?? false, usedDriver: data.usedDriver ?? null })
      logAudit('ai_query', 'ai', 'engineer', undefined, text, 'info', {
        contextSize: data.contextSize ?? 0,
        usedSession: data.usedSession ?? false,
        usedDriver: data.usedDriver ?? null,
      })
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${e?.message ?? 'request failed'}`, ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setContextInfo(null)
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem('rb-ai-conversation') } catch { /* ignore */ }
    }
  }

  const unackCount = anomalies.filter((a) => !a.acknowledged).length

  return (
    <Sheet open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative h-8 gap-1.5 border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 font-mono-nums text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI Engineer</span>
          {unackCount > 0 ? (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center pulse-red">
              {unackCount}
            </span>
          ) : (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 blink" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[440px] p-0 border-l-red-500/30 bg-background/95 backdrop-blur-xl flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border/60 bg-card/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <div className="relative h-7 w-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-[0_0_12px_rgba(248,113,113,0.4)]">
                <Bot className="h-4 w-4 text-white" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />
              </div>
              <div className="leading-tight">
                <div>AI Race Engineer</div>
                <div className="text-[10px] text-muted-foreground font-mono-nums font-normal">LLM · live telemetry context</div>
              </div>
            </SheetTitle>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearChat}>
                Clear
              </Button>
            )}
          </div>
          {contextInfo && (
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground font-mono-nums">
              <span className="text-emerald-400">●</span>
              <span>Context: {contextInfo.contextSize} chars</span>
              {contextInfo.usedSession && <span>· session loaded</span>}
              {contextInfo.usedDriver && <span>· driver {contextInfo.usedDriver}</span>}
            </div>
          )}
        </SheetHeader>

        {/* Active anomaly banner */}
        {unackCount > 0 && (
          <div className="px-4 py-2.5 border-b border-red-500/30 bg-red-500/10 slide-up">
            <div className="flex items-center gap-2 mb-1.5">
              <BellRing className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="text-[11px] font-bold text-red-300 font-mono-nums">{unackCount} ACTIVE ANOMALY{unackCount > 1 ? 'S' : ''}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">auto-diagnosing…</span>
            </div>
            <div className="space-y-1">
              {anomalies.filter((a) => !a.acknowledged).slice(0, 3).map((a) => (
                <div key={a.id} className="text-[10px] text-muted-foreground font-mono-nums truncate flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-red-500 blink shrink-0" />
                  <span className="text-red-300">{a.driverCode}</span>
                  <span>{a.channel.replace(/_/g, ' ')}: {a.value.toFixed(a.channel.includes('temp') || a.channel.includes('pressure') ? 1 : 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div ref={scrollRef} className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <div className="text-sm font-medium">Ask the AI Race Engineer</div>
                  <p className="text-[11px] text-muted-foreground mt-1 px-4">
                    I have live access to your alerts, session laps, delta-P and channel diffs.
                    Ask me anything about performance, setup, or strategy.
                  </p>
                </div>
                <div className="space-y-1.5 text-left pt-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-nums px-1">Suggested questions</div>
                  {SUGGESTIONS.map((s) => {
                    const Icon = s.icon
                    return (
                      <button
                        key={s.label}
                        onClick={() => send(s.prompt)}
                        className="w-full flex items-start gap-2 rounded-md border border-border/50 bg-card/40 p-2 text-left text-xs hover:border-red-500/40 hover:bg-red-500/5 transition-colors"
                      >
                        <Icon className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                        <span>{s.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex gap-2 slide-up', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-red-500/15 text-foreground border border-red-500/30'
                    : 'bg-card/80 text-foreground border border-border/50'
                )}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 slide-up">
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-card/80 border border-border/50 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
                  <span className="text-xs text-muted-foreground font-mono-nums">analyzing telemetry…</span>
                  <span className="flex gap-0.5">
                    <span className="h-1 w-1 rounded-full bg-red-400 speed-pulse" />
                    <span className="h-1 w-1 rounded-full bg-red-400 speed-pulse" style={{ animationDelay: '0.2s' }} />
                    <span className="h-1 w-1 rounded-full bg-red-400 speed-pulse" style={{ animationDelay: '0.4s' }} />
                  </span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border/60 p-3 bg-card/40">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input) }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about deltas, tire deg, setup…"
              disabled={loading}
              className="h-9 text-sm bg-background/60 border-border/60 focus:border-red-500/40"
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !input.trim()}
              className="h-9 px-3 bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="mt-1.5 text-[10px] text-muted-foreground font-mono-nums text-center">
            LLM has live access to alerts · laps · delta-P · channel diffs
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
