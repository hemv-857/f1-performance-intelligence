import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sessions/[id] — session detail with laps grouped by driver + fastest laps
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await db.session.findUnique({
    where: { id },
    include: {
      circuit: true,
      laps: {
        include: { driver: true },
        orderBy: [{ driverId: 'asc' }, { lapNumber: 'asc' }],
      },
    },
  })
  if (!session) return NextResponse.json({ error: 'session not found' }, { status: 404 })

  // group laps by driver
  const byDriver = new Map<string, any>()
  for (const l of session.laps) {
    if (!byDriver.has(l.driverId)) {
      byDriver.set(l.driverId, {
        driver: {
          id: l.driver.id, code: l.driver.code, name: l.driver.name,
          team: l.driver.team, number: l.driver.number, isRival: l.driver.isRival,
        },
        laps: [],
      })
    }
    byDriver.get(l.driverId)!.laps.push({
      id: l.id, lapNumber: l.lapNumber, lapTimeMs: l.lapTimeMs,
      sector1Ms: l.sector1Ms, sector2Ms: l.sector2Ms, sector3Ms: l.sector3Ms,
      tireCompound: l.tireCompound, tireTempAvg: l.tireTempAvg, fuelKg: l.fuelKg,
      drsCount: l.drsCount, isValid: l.isValid, isFastest: l.isFastest,
    })
  }

  // session fastest lap
  const fastest = session.laps.filter((l) => l.isValid).sort((a, b) => a.lapTimeMs - b.lapTimeMs)[0]

  return NextResponse.json({
    session: {
      id: session.id,
      round: session.round,
      type: session.type,
      date: session.date.toISOString(),
      status: session.status,
      airTemp: session.airTemp,
      trackTemp: session.trackTemp,
      condition: session.condition,
      circuit: session.circuit,
      drivers: Array.from(byDriver.values()),
      fastestLap: fastest
        ? {
            driverId: fastest.driverId,
            driverCode: fastest.driver.code,
            driverName: fastest.driver.name,
            lapNumber: fastest.lapNumber,
            lapTimeMs: fastest.lapTimeMs,
            isRival: fastest.driver.isRival,
          }
        : null,
    },
  })
}
