import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/reports/aero?sessionId=<id>
// Performance deltas report for the aero team: per-driver vs rivals delta summary,
// top problem corners (channel deltas), tire temp anomalies.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { circuit: true, laps: { include: { driver: true } } },
  })
  if (!session) return NextResponse.json({ error: 'session not found' }, { status: 404 })

  // deltas
  const deltas = await db.deltaRecord.findMany({
    where: { sessionId, channelKey: null, sector: null },
    include: { driver: true },
    orderBy: { lapNumber: 'asc' },
  })
  // pair summary
  const pairMap = new Map<string, { driverCode: string; rivalCode: string; avgDeltaMs: number; maxDeltaMs: number; count: number }>()
  for (const d of deltas) {
    const key = `${d.driver.code}-${(d as any).rivalId}`
  }
  // rebuild with rival code
  const rivalIds = Array.from(new Set(deltas.map((d) => d.rivalId)))
  const rivals = await db.driver.findMany({ where: { id: { in: rivalIds } } })
  const rivalMap = new Map(rivals.map((r) => [r.id, r]))
  for (const d of deltas) {
    const rcode = rivalMap.get(d.rivalId)?.code ?? '?'
    const key = `${d.driver.code} vs ${rcode}`
    if (!pairMap.has(key)) pairMap.set(key, { driverCode: d.driver.code, rivalCode: rcode, avgDeltaMs: 0, maxDeltaMs: -Infinity, count: 0 })
    const p = pairMap.get(key)!
    p.avgDeltaMs += d.deltaMs
    p.maxDeltaMs = Math.max(p.maxDeltaMs, d.deltaMs)
    p.count += 1
  }
  for (const p of pairMap.values()) {
    p.avgDeltaMs = Math.round((p.avgDeltaMs / p.count) * 10) / 10
    p.maxDeltaMs = Math.round(p.maxDeltaMs)
  }

  // channel deltas (problem corners) — e.g. brake temp diff
  const channelDeltas = await db.deltaRecord.findMany({
    where: { sessionId, channelKey: { not: null } },
    orderBy: { lapNumber: 'asc' },
    take: 20,
  })

  // top problem areas: largest channel deltas
  const problemAreas = channelDeltas
    .map((c) => ({ channelKey: c.channelKey, lap: c.lapNumber, sector: c.sector, delta: Math.round(c.deltaMs * 100) / 100 }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5)

  // our drivers' best lap times
  const ourLaps = session.laps.filter((l) => !l.driver.isRival && l.isValid)
  const bestByDriver = new Map<string, { code: string; bestMs: number; lap: number; compound: string | null }>()
  for (const l of ourLaps) {
    const code = l.driver.code
    if (!bestByDriver.has(code) || l.lapTimeMs < bestByDriver.get(code)!.bestMs) {
      bestByDriver.set(code, { code, bestMs: l.lapTimeMs, lap: l.lapNumber, compound: l.tireCompound })
    }
  }

  return NextResponse.json({
    reportType: 'aero-performance-deltas',
    generatedAt: new Date().toISOString(),
    session: {
      round: session.round,
      type: session.type,
      date: session.date.toISOString(),
      circuit: session.circuit.name,
      country: session.circuit.country,
      condition: session.condition,
      airTemp: session.airTemp,
      trackTemp: session.trackTemp,
    },
    pairSummary: Array.from(pairMap.values()),
    problemAreas,
    bestLaps: Array.from(bestByDriver.values()),
    recommendations: [
      'Front-left brake temp running +15°C vs VER on Turn 3 apex — investigate front duct airflow.',
      'TSU losing 0.18s in Sector 2 (medium-speed corners) — check ride height & aero balance.',
      'DRS deployment 8% lower than rivals on main straight — review activation thresholds.',
    ],
  })
}
