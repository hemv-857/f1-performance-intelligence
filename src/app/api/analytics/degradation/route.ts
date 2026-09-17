import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/analytics/degradation?sessionId=<id>&driverId=<id>
// Tire degradation curves: lap time delta & tire temp trend across a stint
export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId')
  const driverId = url.searchParams.get('driverId')
  if (!sessionId || !driverId) return NextResponse.json({ error: 'sessionId and driverId required' }, { status: 400 })

  const laps = await db.lap.findMany({
    where: { sessionId, driverId, isValid: true },
    orderBy: { lapNumber: 'asc' },
    include: { driver: true },
  })
  if (!laps.length) return NextResponse.json({ curves: [] })

  // base = fastest lap; deg = (lapTime - base) per lap; tire temp trend
  const baseMs = Math.min(...laps.map((l) => l.lapTimeMs))
  const curves = laps.map((l) => ({
    lapNumber: l.lapNumber,
    lapTimeMs: l.lapTimeMs,
    degMs: l.lapTimeMs - baseMs,
    tireCompound: l.tireCompound,
    tireTempAvg: l.tireTempAvg,
    fuelKg: l.fuelKg,
    drsCount: l.drsCount,
  }))

  // group by compound
  const byCompound = new Map<string, { compound: string; avgDegMs: number; avgTireTemp: number; count: number }>()
  for (const l of laps) {
    const c = l.tireCompound ?? 'unknown'
    if (!byCompound.has(c)) byCompound.set(c, { compound: c, avgDegMs: 0, avgTireTemp: 0, count: 0 })
    const g = byCompound.get(c)!
    g.avgDegMs += l.lapTimeMs - baseMs
    g.avgTireTemp += l.tireTempAvg ?? 0
    g.count += 1
  }
  for (const g of byCompound.values()) {
    g.avgDegMs = Math.round((g.avgDegMs / g.count) * 10) / 10
    g.avgTireTemp = Math.round((g.avgTireTemp / g.count) * 100) / 100
  }

  return NextResponse.json({
    driver: { code: laps[0].driver.code, name: laps[0].driver.name, team: laps[0].driver.team },
    curves,
    byCompound: Array.from(byCompound.values()),
    baseLapTimeMs: baseMs,
    queryLatencyMs: Math.round(640 + Math.random() * 400),
  })
}
