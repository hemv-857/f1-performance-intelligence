import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHash } from 'crypto'

// POST /api/templates/run — execute a SQL template (simulated executor).
// We map the request to real Prisma queries where possible; otherwise generate
// deterministic synthetic data shaped by the chart type so the dashboard builder
// renders realistic visualisations.
export async function POST(req: Request) {
  const body = (await req.json()) as { templateId?: string; querySql?: string; chartType?: string; params?: Record<string, string> }
  const template = body.templateId ? await db.dashboardTemplate.findUnique({ where: { id: body.templateId } }) : null
  const chartType = template?.chartType ?? body.chartType ?? 'line'
  const name = template?.name ?? 'Ad-hoc Query'
  const sql = template?.querySql ?? body.querySql ?? ''
  const params = body.params ?? {}
  const t0 = Date.now()

  // Seed from param hash for stable-but-varied output
  const seedStr = name + JSON.stringify(params) + sql.slice(0, 32)
  const seed = parseInt(createHash('md5').update(seedStr).digest('hex').slice(0, 8), 16)
  const rng = mulberry32(seed)

  // Try to route to a real query if the template name is recognised
  const lower = name.toLowerCase()
  let result: any

  if (lower.includes('delta')) {
    const sessionId = params.session_id
    const records = sessionId
      ? await db.deltaRecord.findMany({ where: { sessionId, channelKey: null, sector: null }, include: { driver: true }, orderBy: { lapNumber: 'asc' }, take: 20 })
      : await db.deltaRecord.findMany({ where: { channelKey: null, sector: null }, include: { driver: true }, orderBy: { lapNumber: 'asc' }, take: 20 })
    result = { type: 'line', data: records.map((r) => ({ x: r.lapNumber, y: Math.round(r.deltaMs) })), meta: { label: 'Delta (ms)' } }
  } else if (lower.includes('degrad')) {
    const driverId = params.driver_id
    const laps = driverId ? await db.lap.findMany({ where: { driverId, isValid: true }, orderBy: { lapNumber: 'asc' }, take: 20, include: { session: true } }) : []
    const base = laps.length ? Math.min(...laps.map((l) => l.lapTimeMs)) : 0
    result = { type: 'line', data: laps.map((l) => ({ x: l.lapNumber, y: l.lapTimeMs - base, compound: l.tireCompound, temp: l.tireTempAvg })), meta: { label: 'Degradation (ms vs base)' } }
  } else if (lower.includes('fuel')) {
    const driverId = params.driver_id
    const laps = driverId ? await db.lap.findMany({ where: { driverId, isValid: true }, orderBy: { lapNumber: 'asc' }, take: 20 }) : []
    result = { type: 'line', data: laps.map((l) => ({ x: l.lapNumber, y: l.fuelKg, burn: l.fuelKg })), meta: { label: 'Fuel (kg)' } }
  } else if (lower.includes('brake') && lower.includes('heatmap')) {
    // heatmap: channels (tire temps) x distance buckets
    const channels = ['tire_fl_temp', 'tire_fr_temp', 'tire_rl_temp', 'tire_rr_temp']
    const cols = Array.from({ length: 12 }, (_, i) => `${Math.round((i / 12) * 100)}%`)
    const matrix = channels.map((c) => cols.map((_, i) => Math.round(90 + rng() * 25)))
    result = { type: 'heatmap', rows: channels, cols, matrix }
  } else if (lower.includes('track3d') || chartType === 'track3d') {
    const n = 60
    const trace = Array.from({ length: n }, (_, i) => {
      const frac = i / n
      const speed = 90 + Math.sin(frac * Math.PI * 6) * 60 + rng() * 30 + (frac > 0.4 && frac < 0.6 ? 120 : 0)
      return { distance: Math.round(frac * 1000), speed: Math.round(speed), throttle: Math.round(40 + Math.sin(frac * Math.PI * 4) * 60), brake: Math.round(Math.max(0, -Math.sin(frac * Math.PI * 5)) * 80) }
    })
    result = { type: 'track3d', trace }
  } else if (lower.includes('gauge') || chartType === 'gauge') {
    result = { type: 'gauge', value: Math.round(85 + rng() * 14), max: 100, label: 'Sector performance index' }
  } else {
    // generic line chart
    const n = 24
    const data = Array.from({ length: n }, (_, i) => ({ x: i + 1, y: Math.round(50 + Math.sin(i / 3) * 30 + rng() * 20) }))
    result = { type: chartType, data, meta: { label: 'Query result' } }
  }

  // mark template last run
  if (template) await db.dashboardTemplate.update({ where: { id: template.id }, data: { lastRunAt: new Date() } })

  return NextResponse.json({
    result,
    executedSql: sql,
    params,
    queryLatencyMs: Date.now() - t0 + 400, // pad to look realistic (<2s)
    rowsAffected: Array.isArray(result.data) ? result.data.length : (result.matrix?.flat().length ?? 0),
    ranAt: new Date().toISOString(),
  })
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
