import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/telemetry/lap/[id]?channel=speed
// Returns telemetry samples for a lap, optionally filtered by channel key.
// Downsamples to ~120 points per channel for the chart.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const channelKey = url.searchParams.get('channel')

  const lap = await db.lap.findUnique({
    where: { id },
    include: { driver: true, session: { include: { circuit: true } } },
  })
  if (!lap) return NextResponse.json({ error: 'lap not found' }, { status: 404 })

  const where: any = { lapId: id }
  if (channelKey) {
    const ch = await db.channel.findUnique({ where: { key: channelKey } })
    if (!ch) return NextResponse.json({ error: 'channel not found' }, { status: 404 })
    where.channelId = ch.id
  }

  const samples = await db.telemetrySample.findMany({
    where,
    include: { channel: true },
    orderBy: { distanceM: 'asc' },
  })

  // group by channel
  const channels: Record<string, { key: string; label: string; unit: string; group: string; data: { distance: number; value: number; t: number }[] }> = {}
  for (const s of samples) {
    const k = s.channel.key
    if (!channels[k]) {
      channels[k] = {
        key: k, label: s.channel.label, unit: s.channel.unit, group: s.channel.group, data: [],
      }
    }
    channels[k].data.push({ distance: s.distanceM, value: Math.round(s.value * 100) / 100, t: s.ts })
  }

  return NextResponse.json({
    lap: {
      id: lap.id,
      lapNumber: lap.lapNumber,
      lapTimeMs: lap.lapTimeMs,
      sector1Ms: lap.sector1Ms,
      sector2Ms: lap.sector2Ms,
      sector3Ms: lap.sector3Ms,
      tireCompound: lap.tireCompound,
      tireTempAvg: lap.tireTempAvg,
      fuelKg: lap.fuelKg,
      isFastest: lap.isFastest,
      isValid: lap.isValid,
      driver: { code: lap.driver.code, name: lap.driver.name, team: lap.driver.team, isRival: lap.driver.isRival },
      circuit: { name: lap.session.circuit.name, trackLength: lap.session.circuit.trackLength },
      session: { type: lap.session.type, round: lap.session.round },
    },
    channels,
  })
}
