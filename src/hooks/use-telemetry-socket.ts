'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { LiveDriverSnapshot, LiveTick, PipelineState } from '@/lib/types'

// Connects to the F1 telemetry streaming service (port 3003 via Caddy gateway).
// Simulates Kafka topic subscription + Spark streaming aggregation push.
export function useTelemetrySocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [drivers, setDrivers] = useState<LiveDriverSnapshot[]>([])
  const [ticks, setTicks] = useState<Record<string, LiveTick>>({})
  const [pipeline, setPipeline] = useState<PipelineState | null>(null)
  const [sparkWindows, setSparkWindows] = useState<any[]>([])
  const [incident, setIncident] = useState<{ type: string; message: string; severity: string; ts: number } | null>(null)
  const [recovered, setRecovered] = useState<string | null>(null)
  const [playbookResult, setPlaybookResult] = useState<{ playbook: string; steps: string[]; durationMs: number; ts: number } | null>(null)
  const [synthetic, setSynthetic] = useState<{ phase: 'start' | 'done' | null; message?: string; result?: any }>({ phase: null })

  useEffect(() => {
    const s = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      timeout: 10000,
    })
    socketRef.current = s

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('reconnect_attempt', () => setConnected(false))

    s.on('drivers:snapshot', (data: LiveDriverSnapshot[]) => setDrivers(data))
    s.emit('subscribe', { drivers: ['TSU', 'LAW', 'VER'] })
    s.on('telemetry:tick', (batch: LiveTick[]) => {
      setTicks((prev) => {
        const next = { ...prev }
        for (const t of batch) next[t.code] = t
        return next
      })
    })
    s.on('pipeline:state', (st: PipelineState) => setPipeline(st))
    s.on('spark:aggregation', (payload: any) => setSparkWindows(payload.windows ?? []))
    s.on('pipeline:incident', (i: any) => { setIncident(i); setRecovered(null) })
    s.on('pipeline:recovered', (r: any) => { setRecovered(r.message); setIncident(null) })
    s.on('playbook:done', (r: any) => setPlaybookResult(r))
    s.on('health:synthetic-start', (r: any) => setSynthetic({ phase: 'start', message: r.message }))
    s.on('health:synthetic-done', (r: any) => setSynthetic({ phase: 'done', message: r.message, result: r.result }))

    return () => {
      s.emit('unsubscribe')
      s.disconnect()
    }
  }, [])

  const runPlaybook = (playbook: string) => {
    socketRef.current?.emit('playbook:run', { playbook })
  }
  const runSyntheticRace = () => {
    socketRef.current?.emit('health:run-synthetic-race')
  }

  return {
    connected,
    drivers,
    ticks,
    pipeline,
    sparkWindows,
    incident,
    recovered,
    playbookResult,
    clearPlaybookResult: () => setPlaybookResult(null),
    synthetic,
    clearSynthetic: () => setSynthetic({ phase: null }),
    runPlaybook,
    runSyntheticRace,
  }
}
