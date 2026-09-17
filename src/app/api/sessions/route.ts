import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sessions — list all sessions with circuit + lap counts
export async function GET() {
  const sessions = await db.session.findMany({
    include: {
      circuit: true,
      laps: { select: { id: true, driverId: true, isValid: true } },
    },
    orderBy: [{ round: 'asc' }, { date: 'asc' }],
  })
  const data = sessions.map((s) => ({
    id: s.id,
    round: s.round,
    type: s.type,
    date: s.date.toISOString(),
    status: s.status,
    airTemp: s.airTemp,
    trackTemp: s.trackTemp,
    condition: s.condition,
    circuit: { id: s.circuit.id, name: s.circuit.name, country: s.circuit.country, trackLength: s.circuit.trackLength, corners: s.circuit.corners },
    lapCount: s.laps.length,
    validLapCount: s.laps.filter((l) => l.isValid).length,
  }))
  return NextResponse.json({ sessions: data })
}
