import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AI_API_URL = process.env.AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions'
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'qwen/qwen3.8-27b'

// POST /api/ai-engineer
// Body: { message: string, sessionId?: string, driverCode?: string, history?: [{role,content}] }
// The AI Race Engineer Assistant diagnoses telemetry anomalies using live context
// from the database (laps, deltas, alerts) + the engineer's question.
export async function POST(req: Request) {
  const body = await req.json()
  const { message, sessionId, driverCode, history = [] } = body as {
    message: string
    sessionId?: string
    driverCode?: string
    history: { role: 'user' | 'assistant'; content: string }[]
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  if (!AI_API_KEY) {
    return NextResponse.json(
      { error: 'AI API not configured', reply: 'AI_API_KEY environment variable is not set. Please configure an OpenAI-compatible API key.' },
      { status: 503 }
    )
  }

  // ---- Gather live context from the warehouse ----
  let context = 'F1 Performance Intelligence Platform — Racing Bulls\n'
  context += `Current time: ${new Date().toISOString()}\n\n`

  // Active alerts
  const alerts = await db.alert.findMany({
    where: { status: { in: ['active', 'acknowledged'] } },
    include: { driver: true },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })
  if (alerts.length) {
    context += 'ACTIVE ALERTS:\n'
    for (const a of alerts) {
      context += `- [${a.severity.toUpperCase()}] ${a.source}: ${a.title} — ${a.message}`
      if (a.driver) context += ` (driver: ${a.driver.code})`
      context += '\n'
    }
    context += '\n'
  }

  // Session + lap context
  if (sessionId) {
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { circuit: true, laps: { include: { driver: true } } },
    })
    if (session) {
      context += `SESSION: Round ${session.round} ${session.type} at ${session.circuit.name} (${session.circuit.country}), ${session.circuit.trackLength}km, ${session.circuit.corners} corners. Status: ${session.status}. Air ${session.airTemp?.toFixed(1)}°C, Track ${session.trackTemp?.toFixed(1)}°C.\n`
      // best laps per driver
      const byDriver = new Map<string, { code: string; name: string; isRival: boolean; best: { lapTimeMs: number; lapNumber: number; tireCompound: string | null; sector1Ms: number | null; sector2Ms: number | null; sector3Ms: number | null } }>()
      for (const l of session.laps) {
        if (!l.isValid) continue
        const existing = byDriver.get(l.driver.code)
        if (!existing || l.lapTimeMs < existing.best.lapTimeMs) {
          byDriver.set(l.driver.code, {
            code: l.driver.code, name: l.driver.name, isRival: l.driver.isRival,
            best: l,
          })
        }
      }
      context += 'BEST LAPS:\n'
      const sorted = Array.from(byDriver.values()).sort((a, b) => a.best.lapTimeMs - b.best.lapTimeMs)
      for (const d of sorted) {
        context += `- ${d.code} (${d.name}, ${d.isRival ? 'rival' : 'ours'}): ${fmtLap(d.best.lapTimeMs)} L${d.best.lapNumber} ${d.best.tireCompound} — S1 ${fmtLap(d.best.sector1Ms)} S2 ${fmtLap(d.best.sector2Ms)} S3 ${fmtLap(d.best.sector3Ms)}\n`
      }
      context += '\n'
    }
  }

  // Delta-P summary for the driver
  if (sessionId && driverCode) {
    const driver = await db.driver.findUnique({ where: { code: driverCode } })
    if (driver) {
      const deltas = await db.deltaRecord.findMany({
        where: { sessionId, driverId: driver.id, channelKey: null, sector: null },
        orderBy: { lapNumber: 'asc' },
      })
      if (deltas.length) {
        const rivalIds = Array.from(new Set(deltas.map((d) => d.rivalId)))
        const rivals = await db.driver.findMany({ where: { id: { in: rivalIds } } })
        const rivalMap = new Map(rivals.map((r) => [r.id, r]))
        context += `DELTA-P for ${driverCode}:\n`
        for (const d of deltas.slice(-6)) {
          const rcode = rivalMap.get(d.rivalId)?.code ?? '?'
          context += `- L${d.lapNumber} vs ${rcode}: ${d.deltaMs > 0 ? '+' : ''}${(d.deltaMs / 1000).toFixed(3)}s\n`
        }
        // channel deltas (problem zones)
        const channelDeltas = await db.deltaRecord.findMany({
          where: { sessionId, driverId: driver.id, channelKey: { not: null } },
          orderBy: { lapNumber: 'asc' },
          take: 10,
        })
        if (channelDeltas.length) {
          context += 'CHANNEL DELTAS (problem zones):\n'
          for (const c of channelDeltas.slice(-5)) {
            context += `- L${c.lapNumber} S${c.sector} ${c.channelKey}: ${c.deltaMs > 0 ? '+' : ''}${c.deltaMs.toFixed(2)}\n`
          }
        }
        context += '\n'
      }
    }
  }

  // ---- System prompt ----
  const systemPrompt = `You are the AI Race Engineer Assistant for the Racing Bulls F1 team (Performance Intelligence Platform).
You help performance engineers diagnose telemetry anomalies, interpret delta-P vs rivals, recommend setup changes, and plan race strategy.

You have access to LIVE platform context (active alerts, session results, delta-P, channel diffs) which will be provided in the user message.
Use that context to give SPECIFIC, DATA-DRIVEN answers. Reference actual driver codes, lap times, deltas, and channel values.

Style:
- Concise and technical (F1 engineers are the audience). 2-4 short paragraphs max.
- Use bullet points for actionable recommendations.
- Reference specific corners/sectors/distance bins when discussing channel diffs.
- If recommending a setup change, state the parameter, direction, and expected gain (e.g. "Front ride height -1mm → ~40ms gain in S2").
- Never invent data — only use the provided context. If context is missing, say so.
- End with a clear next-step recommendation.

PLATFORM CONTEXT:\n${context}`

  // ---- Call the LLM ----
  try {
    const messages = [
      { role: 'assistant' as const, content: systemPrompt },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: message },
    ]

    const res = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json(
        { error: 'LLM call failed', detail: err, reply: 'I could not reach the model right now. Please retry.' },
        { status: 502 }
      )
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content ?? ''
    return NextResponse.json({
      reply,
      contextSize: context.length,
      usedSession: !!sessionId,
      usedDriver: driverCode ?? null,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json(
      { error: 'LLM call failed', detail: msg, reply: 'I could not reach the model right now. Please retry.' },
      { status: 500 }
    )
  }
}

function fmtLap(ms: number | null): string {
  if (ms == null) return '—'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
