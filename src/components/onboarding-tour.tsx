'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Trophy,
  Gauge,
  Bot,
  Keyboard,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Flag,
  type LucideIcon,
} from 'lucide-react'

const STORAGE_KEY = 'rb-onboarding-complete'
const RESTART_EVENT = 'rb-restart-onboarding'
const AUTO_START_DELAY = 1500 // ms

interface Step {
  title: string
  description: React.ReactNode
  icon: LucideIcon
  badge?: LucideIcon
  iconWrap: string // bg + ring classes for the icon circle
  iconColor: string
  badgeWrap: string
  badgeColor: string
}

const STEPS: Step[] = [
  {
    title: 'Welcome to the Apex Racing Performance Intelligence Platform',
    description: (
      <>
        Your unified engineering workstation for race weekend operations.{' '}
        <span className="text-foreground font-medium">8 integrated views</span>, live{' '}
        <span className="text-foreground font-medium">1 kHz telemetry</span>, and a proactive{' '}
        <span className="text-foreground font-medium">AI Race Engineer</span> — all in one place.
        This quick tour will show you the essentials.
      </>
    ),
    icon: Trophy,
    badge: Flag,
    iconWrap: 'bg-amber-500/15 ring-amber-500/30',
    iconColor: 'text-amber-400',
    badgeWrap: 'bg-amber-500/20 ring-amber-500/40',
    badgeColor: 'text-amber-300',
  },
  {
    title: 'Live Telemetry & Timing',
    description: (
      <>
        <span className="text-foreground font-medium">100+ channels</span> stream at{' '}
        <span className="text-foreground font-mono-nums">1 kHz</span> from our Kafka + Spark
        pipeline. The Telemetry Viewer overlays laps, diffs channels, and flags anomalies in real
        time. Live timing updates every tick from the websocket feed.
      </>
    ),
    icon: Gauge,
    iconWrap: 'bg-emerald-500/15 ring-emerald-500/30',
    iconColor: 'text-emerald-400',
    badgeWrap: '',
    badgeColor: '',
  },
  {
    title: 'AI Race Engineer',
    description: (
      <>
        Tap the <span className="text-foreground font-medium">Bot icon</span> in the header to chat
        with your AI Race Engineer. When a channel goes out of range, the AI{' '}
        <span className="text-foreground font-medium">auto-diagnoses</span> the root cause and
        surfaces a recommended fix — no need to ask.
      </>
    ),
    icon: Bot,
    badge: Sparkles,
    iconWrap: 'bg-violet-500/15 ring-violet-500/30',
    iconColor: 'text-violet-400',
    badgeWrap: 'bg-violet-500/20 ring-violet-500/40',
    badgeColor: 'text-violet-300',
  },
  {
    title: 'Keyboard Shortcuts',
    description: (
      <>
        Move fast with two-key view switching. Press{' '}
        <Kbd>?</Kbd> any time for the full reference, or{' '}
        <Kbd>⌘K</Kbd> to open the command palette.
      </>
    ),
    icon: Keyboard,
    iconWrap: 'bg-red-500/15 ring-red-500/30',
    iconColor: 'text-red-400',
    badgeWrap: '',
    badgeColor: '',
  },
  {
    title: 'Ready to race',
    description: (
      <>
        You're all set. The platform will{' '}
        <span className="text-foreground font-medium">auto-diagnose anomalies</span>, track your
        activity on the <span className="text-foreground font-medium">leaderboard</span>, and{' '}
        <span className="text-foreground font-medium">persist your preferences</span> across
        sessions. Welcome aboard, engineer.
      </>
    ),
    icon: CheckCircle2,
    iconWrap: 'bg-emerald-500/15 ring-emerald-500/30',
    iconColor: 'text-emerald-400',
    badgeWrap: '',
    badgeColor: '',
  },
]

const SHORTCUT_HINTS: { keys: string[]; label: string }[] = [
  { keys: ['g', 'o'], label: 'Overview' },
  { keys: ['g', 't'], label: 'Telemetry' },
  { keys: ['?'], label: 'Shortcuts help' },
  { keys: ['⌘K'], label: 'Command palette' },
]

// Module-level ref so the exported `restartTour` can poke the mounted instance.
// Falls back to a CustomEvent so it works even before mount or across
// duplicate module instances in the bundler.
let mountedRestart: (() => void) | null = null

/**
 * Clears the onboarding "completed" flag and re-opens the tour from step 1.
 * Safe to call from anywhere (e.g. the Settings drawer's "Retake tour" button).
 *
 * Uses a window CustomEvent as the transport (in addition to the direct
 * `mountedRestart` ref) so it remains robust across bundler chunk boundaries
 * where the caller and the OnboardingTour instance might live in different
 * module copies.
 */
export function restartTour(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    // Always dispatch the event — the OnboardingTour listens for it globally.
    window.dispatchEvent(new CustomEvent(RESTART_EVENT))
  }
  if (mountedRestart) {
    mountedRestart()
  }
}

export function OnboardingTour() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)

  // ---- Auto-start on first visit (after a short delay) ----
  useEffect(() => {
    if (typeof window === 'undefined') return
    let alreadyDone = false
    try {
      alreadyDone = localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      /* ignore */
    }
    if (alreadyDone) return
    const t = setTimeout(() => setOpen(true), AUTO_START_DELAY)
    return () => clearTimeout(t)
  }, [])

  // ---- Register the restart handler so `restartTour()` can re-open us ----
  useEffect(() => {
    const handler = () => {
      setDirection(1)
      setStep(0)
      setOpen(true)
    }
    mountedRestart = handler
    window.addEventListener(RESTART_EVENT, handler)
    return () => {
      mountedRestart = null
      window.removeEventListener(RESTART_EVENT, handler)
    }
  }, [])

  const complete = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, 'true')
      } catch {
        /* ignore */
      }
    }
    setOpen(false)
  }, [])

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= STEPS.length - 1) {
        complete()
        return s
      }
      setDirection(1)
      return s + 1
    })
  }, [complete])

  const prev = useCallback(() => {
    setStep((s) => {
      if (s <= 0) return s
      setDirection(-1)
      return s - 1
    })
  }, [])

  // Esc = skip to end
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        complete()
      } else if (e.key === 'ArrowRight') {
        next()
      } else if (e.key === 'ArrowLeft') {
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, complete, next, prev])

  // Lock body scroll while the tour is open
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const Icon = current.icon
  const Badge = current.badge

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rb-onboarding-title"
        >
          <motion.div
            className="relative w-full max-w-md rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* close (skip) button */}
            <button
              onClick={complete}
              className="absolute right-3 top-3 z-10 p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>

            {/* top accent line */}
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

            <div className="p-6 sm:p-7">
              {/* icon circle */}
              <div className="flex justify-center mb-5">
                <div className={cn('relative h-16 w-16 rounded-full flex items-center justify-center ring-1', current.iconWrap)}>
                  <Icon className={cn('h-8 w-8', current.iconColor)} />
                  {Badge && (
                    <span
                      className={cn(
                        'absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center ring-1 bg-card',
                        current.badgeWrap,
                      )}
                    >
                      <Badge className={cn('h-3.5 w-3.5', current.badgeColor)} />
                    </span>
                  )}
                </div>
              </div>

              {/* step body — slide transition keyed on `step` */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  initial={{ opacity: 0, x: 24 * direction }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 * direction }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="text-center"
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono-nums mb-2">
                    Step {step + 1} of {STEPS.length}
                  </div>
                  <h2
                    id="rb-onboarding-title"
                    className="text-xl font-bold tracking-tight mb-3 leading-snug"
                  >
                    {current.title}
                  </h2>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {current.description}
                  </div>

                  {/* keyboard-shortcut step: show a small kbd grid */}
                  {step === 3 && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                      {SHORTCUT_HINTS.map((h) => (
                        <div
                          key={h.label}
                          className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5"
                        >
                          <span className="text-[11px] text-muted-foreground">{h.label}</span>
                          <span className="flex gap-1">
                            {h.keys.map((k, i) => (
                              <kbd
                                key={i}
                                className="text-[10px] font-mono-nums border border-border/60 rounded px-1.5 py-0.5 bg-background/60 text-foreground"
                              >
                                {k}
                              </kbd>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* progress dots */}
              <div className="flex items-center justify-center gap-2 mt-6 mb-5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    aria-label={`Step ${i + 1}${i === step ? ' (current)' : ''}`}
                    className={cn(
                      'h-2 rounded-full transition-all duration-200',
                      i === step ? 'w-6 bg-red-500' : i < step ? 'w-2 bg-red-500/50' : 'w-2 bg-zinc-700',
                    )}
                  />
                ))}
              </div>

              {/* nav row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={complete}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Skip tour
                </button>

                {step > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prev}
                    className="ml-auto"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                )}

                <Button
                  variant="default"
                  size="sm"
                  onClick={next}
                  className={cn(step === 0 && 'ml-auto')}
                >
                  {isLast ? 'Start using the platform' : 'Next'}
                  {isLast ? <CheckCircle2 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center align-middle text-[10px] font-mono-nums border border-border/60 rounded px-1.5 py-0.5 bg-background/60 text-foreground mx-0.5">
      {children}
    </kbd>
  )
}
