import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/telemetry/compare?lapA=<id>&lapB=<id>&channel=speed
// Returns two aligned traces + per-distance diff (for "why is our brake temp 15°C higher on T3?" highlighting)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const lapAId = url.searchParams.get('lapA')
  const lapBId = url.searchParams.get('lapB')
  const channelKey = url.searchParams.get('channel') || 'speed'
  if (!lapAId || !lapBId) return NextResponse.json({ error: 'lapA and lapB required' }, { status: 400 })

  const [lapA, lapB] = await Promise.all([
    db.lap.findUnique({ where: { id: lapAId }, include: { driver: true, session: { include: { circuit: true } } } }),
    db.lap.findUnique({ where: { id: lapBId }, include: { driver: true } }),
  ])
  if (!lapA || !lapB) return NextResponse.json({ error: 'lap not found' }, { status: 404 })

  const ch = await db.channel.findUnique({ where: { key: channelKey } })
  if (!ch) return NextResponse.json({ error: 'channel not found' }, { status: 404 })

  const [samplesA, samplesB] = await Promise.all([
    db.telemetrySample.findMany({ where: { lapId: lapAId, channelId: ch.id }, orderBy: { distanceM: 'asc' } }),
    db.telemetrySample.findMany({ where: { lapId: lapBId, channelId: ch.id }, orderBy: { distanceM: 'asc' } }),
  ])

  // align by index (both have 120 samples)
  const n = Math.min(samplesA.length, samplesB.length)
  const traceA: { distance: number; value: number }[] = []
  const traceB: { distance: number; value: number }[] = []
  const diff: { distance: number; delta: number; absDelta: number }[] = []
  for (let i = 0; i < n; i++) {
    const dist = samplesA[i].distanceM
    const va = Math.round(samplesA[i].value * 100) / 100
    const vb = Math.round(samplesB[i].value * 100) / 100
    traceA.push({ distance: dist, value: va })
    traceB.push({ distance: dist, value: vb })
    diff.push({ distance: dist, delta: Math.round((va - vb) * 100) / 100, absDelta: Math.round(Math.abs(va - vb) * 100) / 100 })
  }
  // highlight top-N biggest abs diffs ("problem zones")
  const zones = [...diff].sort((a, b) => b.absDelta - a.absDelta).slice(0, 5).map((z) => ({
    distance: z.distance, delta: z.delta, absDelta: z.absDelta,
  }))

  return NextResponse.json({
    channel: { key: ch.key, label: ch.label, unit: ch.unit, group: ch.group, minOk: ch.minOk, maxOk: ch.maxOk },
    lapA: { id: lapA.id, lapNumber: lapA.lapNumber, lapTimeMs: lapA.lapTimeMs, driver: { code: lapA.driver.code, name: lapA.driver.name, team: lapA.driver.team, isRival: lapA.driver.isRival }, session: { type: lapA.session.type, round: lapA.session.round, circuit: lapA.session.circuit.name } },
    lapB: { id: lapB.id, lapNumber: lapB.lapNumber, lapTimeMs: lapB.lapTimeMs, driver: { code: lapB.driver.code, name: lapB.driver.name, team: lapB.driver.team, isRival: lapB.driver.isRival } },
    traceA, traceB, diff, zones,
  })
}
