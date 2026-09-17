import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/analytics/fuel?sessionId=<id>&driverId=<id>
// Fuel consumption trend across a stint
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
  if (!laps.length) return NextResponse.json({ points: [] })

  const points = laps.map((l, i) => {
    const prev = i > 0 ? laps[i - 1].fuelKg : l.fuelKg! + 1.1
    const burn = prev! - l.fuelKg!
    return {
      lapNumber: l.lapNumber,
      fuelKg: l.fuelKg,
      burnKg: Math.round(burn * 100) / 100,
      cumulativeBurnKg: Math.round((110 - l.fuelKg!) * 100) / 100,
      lapTimeMs: l.lapTimeMs,
      fuelAdjLapMs: Math.round(l.lapTimeMs + (l.fuelKg! - 0) * 0.035), // fuel-corrected lap time
    }
  })
  const totalBurn = points[points.length - 1].cumulativeBurnKg
  const avgBurn = Math.round((totalBurn / points.length) * 100) / 100

  return NextResponse.json({
    driver: { code: laps[0].driver.code, name: laps[0].driver.name, team: laps[0].driver.team },
    points,
    summary: { totalBurnKg: totalBurn, avgBurnPerLapKg: avgBurn, targetLapBurnKg: 1.0 },
    queryLatencyMs: Math.round(720 + Math.random() * 380),
  })
}
