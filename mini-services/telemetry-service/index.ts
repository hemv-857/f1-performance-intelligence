// F1 Telemetry Streaming Service
// Simulates Kafka topic ingestion + Spark Streaming aggregation for live race telemetry.
// Streams 100+ channels at ~1kHz (downsampled to ~10Hz per socket push for web clients).
// Port: 3003 (forwarded via Caddy gateway with XTransformPort).

import { createServer } from 'http'
import { Server } from 'socket.io'
import { createHash } from 'crypto'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change path — Caddy uses it to route
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------- Domain state ----------

interface LiveDriver {
  code: string
  name: string
  team: string
  number: number
  isRival: boolean
  // simulated car state
  lap: number
  lapProgress: number // 0..1
  sector: number
  lapStartTime: number
  tireCompound: string
  tireTemp: number
  fuelKg: number
  drsActive: boolean
  // smoothed channel values (so charts look smooth)
  channels: Record<string, number>
}

const OUR_DRIVERS = [
  { code: 'TSU', name: 'Yuki Tsunoda', team: 'Apex Racing', number: 22, isRival: false },
  { code: 'LAW', name: 'Liam Lawson', team: 'Apex Racing', number: 30, isRival: false },
]
const RIVALS = [
  { code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', number: 1, isRival: true },
  { code: 'NOR', name: 'Lando Norris', team: 'McLaren', number: 4, isRival: true },
  { code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari', number: 16, isRival: true },
  { code: 'RUS', name: 'George Russell', team: 'Mercedes', number: 63, isRival: true },
]

// corner distance fractions on the simulated lap (Singapore-like street circuit)
const CORNERS = [0.03, 0.08, 0.14, 0.20, 0.26, 0.32, 0.38, 0.44, 0.50, 0.55, 0.60, 0.66, 0.72, 0.78, 0.84, 0.90, 0.95]
const LAP_MS = 103000 // base lap time
const CHANNEL_KEYS = [
  'speed', 'throttle', 'brake', 'gear', 'rpm',
  'tire_fl_temp', 'tire_fr_temp', 'tire_rl_temp', 'tire_rr_temp',
  'suspension_fl', 'suspension_fr', 'boost_pressure', 'fuel_flow', 'drs',
]
const SKILL: Record<string, number> = {
  VER: 0.997, LEC: 0.999, NOR: 0.998, RUS: 0.996,
  TSU: 0.992, LAW: 0.990,
}

function nearestCornerDist(frac: number) {
  let min = 1
  for (const c of CORNERS) {
    const d = Math.abs(c - frac)
    if (d < min) min = d
  }
  return min
}

function genChannelValue(key: string, frac: number, driver: LiveDriver): number {
  const dist = nearestCornerDist(frac)
  const isBraking = dist < 0.03
  const isApex = dist < 0.012
  const isStraight = dist > 0.06
  const skill = SKILL[driver.code] ?? 0.99
  const noise = () => (Math.random() - 0.5) * 2
  switch (key) {
    case 'speed':
      if (isStraight) return 280 + 50 * skill + noise() * 6
      if (isBraking && !isApex) return 200 - 80 * (0.03 - dist) / 0.03 + noise() * 4
      if (isApex) return 90 + 40 * skill + noise() * 3
      return 140 + 80 * (dist - 0.012) / 0.05 + noise() * 4
    case 'throttle':
      if (isStraight) return 100
      if (isApex) return 20 + noise() * 6
      if (isBraking) return 0
      return 60 + noise() * 8
    case 'brake':
      if (isBraking && !isApex) return 70 + noise() * 12
      return Math.max(0, noise() * 2)
    case 'gear':
      if (isStraight) return 8
      if (isApex) return 3
      if (isBraking) return 5
      return 6
    case 'rpm': {
      const g = isStraight ? 8 : isApex ? 3 : isBraking ? 5 : 6
      return Math.min(12500, 1500 + g * 1300 + noise() * 300)
    }
    case 'tire_fl_temp':
    case 'tire_fr_temp':
    case 'tire_rl_temp':
    case 'tire_rr_temp': {
      const isFront = key.includes('fl') || key.includes('fr')
      return 95 + (isApex ? 12 : isBraking ? 8 : 0) + (isFront ? (isBraking ? 5 : 0) : isStraight ? 4 : 0) + noise() * 2
    }
    case 'suspension_fl':
    case 'suspension_fr':
      if (isApex) return -22 + noise() * 3
      if (isBraking) return -8 + noise() * 2
      return -2 + noise() * 1.5
    case 'boost_pressure':
      return 2.5 + 0.8 * skill + (isStraight ? 0.4 : 0) + noise() * 0.08
    case 'fuel_flow':
      if (isStraight) return 100 + noise() * 4
      if (isApex) return 40 + noise() * 6
      if (isBraking) return 10 + noise() * 3
      return 70 + noise() * 5
    case 'drs':
      return isStraight && frac > 0.5 ? 1 : 0
    default:
      return 50 + noise() * 5
  }
}

// Initialize drivers
const drivers: LiveDriver[] = [...OUR_DRIVERS, ...RIVALS].map((d) => ({
  ...d,
  lap: 1,
  lapProgress: Math.random() * 0.3,
  sector: 1,
  lapStartTime: Date.now(),
  tireCompound: 'medium',
  tireTemp: 95,
  fuelKg: 110,
  drsActive: false,
  channels: {},
}))

for (const d of drivers) {
  for (const k of CHANNEL_KEYS) {
    d.channels[k] = genChannelValue(k, d.lapProgress, d)
  }
}

// ---------- Spark Streaming aggregation (every 5s) ----------
const aggregations = {
  lastRun: Date.now(),
  windows: drivers.map((d) => ({
    driverCode: d.code,
    avgSpeed: 0,
    maxSpeed: 0,
    avgTireTemp: 0,
    avgThrottle: 0,
    avgBrake: 0,
    fuelBurned: 0,
    sampleCount: 0,
    points: [] as { t: number; v: number }[],
  })),
}

function runSparkAggregation() {
  for (const w of aggregations.windows) {
    w.sampleCount += Math.floor(Math.random() * 8000 + 4000) // simulated 1kHz * 5s samples
    w.avgSpeed = 230 + Math.random() * 20
    w.maxSpeed = 320 + Math.random() * 15
    w.avgTireTemp = 96 + Math.random() * 6
    w.avgThrottle = 62 + Math.random() * 8
    w.avgBrake = 14 + Math.random() * 6
    w.fuelBurned = 5.2 + Math.random() * 1.2
    w.points = [
      ...w.points.slice(-30),
      { t: Date.now(), v: Math.round(w.avgSpeed) },
    ]
  }
  aggregations.lastRun = Date.now()
}

// ---------- Pipeline health (simulated) ----------
let pipelineState = {
  primaryHealthy: true,
  secondaryBufferArmed: false,
  consumerLagMs: 400,
  sparkJobsRunning: 3,
  ingestRateHz: 1000,
  dataLossGuarantee: true,
  uptimePct: 99.97,
}

// tick: advance each driver along the lap, update channels
function tick() {
  const now = Date.now()
  for (const d of drivers) {
    // advance progress: lap takes LAP_MS, so per-tick (250ms) advance ~ 250/LAP_MS
    const dt = 250 / LAP_MS
    d.lapProgress += dt * (SKILL[d.code] ?? 0.99)
    if (d.lapProgress >= 1) {
      d.lapProgress = 0
      d.lap += 1
      d.lapStartTime = now
      d.fuelKg = Math.max(0, d.fuelKg - 1.1)
      // random deg
      d.tireTemp = 95 + d.lap * 0.4 + Math.random() * 2
    }
    d.sector = d.lapProgress < 0.32 ? 1 : d.lapProgress < 0.67 ? 2 : 3
    // update channel values
    for (const k of CHANNEL_KEYS) {
      const target = genChannelValue(k, d.lapProgress, d)
      // smooth toward target
      d.channels[k] = d.channels[k] + (target - d.channels[k]) * 0.35
    }
    d.drsActive = d.channels['drs'] > 0.5
  }
}

const tickInterval = setInterval(tick, 250)
const sparkInterval = setInterval(runSparkAggregation, 5000)

// Simulate occasional pipeline anomalies (rare)
setInterval(() => {
  const r = Math.random()
  if (r < 0.05) {
    pipelineState.consumerLagMs = 14000 + Math.random() * 4000
    pipelineState.primaryHealthy = false
    pipelineState.secondaryBufferArmed = true
    console.log(`[SPARK] consumer lag spike -> ${pipelineState.consumerLagMs}ms, failover to secondary buffer`)
    io.emit('pipeline:incident', {
      type: 'latency-spike',
      message: 'Consumer lag spike detected — auto-killing duplicate workers, arming secondary buffer.',
      severity: 'critical',
      ts: Date.now(),
    })
  } else if (r < 0.1) {
    pipelineState.consumerLagMs = 400 + Math.random() * 400
    pipelineState.primaryHealthy = true
    pipelineState.secondaryBufferArmed = false
    console.log(`[SPARK] recovered, lag -> ${pipelineState.consumerLagMs}ms`)
    io.emit('pipeline:recovered', {
      message: 'Pipeline recovered — primary healthy, secondary buffer disarmed.',
      ts: Date.now(),
    })
  }
}, 12000)

// ---------- Socket events ----------
io.on('connection', (socket) => {
  console.log(`[WS] client connected: ${socket.id}`)

  // send initial snapshot
  socket.emit('drivers:snapshot', drivers.map((d) => ({
    code: d.code, name: d.name, team: d.team, number: d.number, isRival: d.isRival,
    lap: d.lap, sector: d.sector, tireCompound: d.tireCompound, fuelKg: Math.round(d.fuelKg * 10) / 10,
  })))

  socket.emit('pipeline:state', pipelineState)

  // client subscribes to a set of drivers' channels
  socket.on('subscribe', (payload: { drivers: string[]; channels?: string[] }) => {
    socket.join('telemetry')
  })

  socket.on('unsubscribe', () => {
    socket.leave('telemetry')
  })

  // health probe (synthetic race simulation trigger)
  let simRunning = false
  socket.on('health:run-synthetic-race', () => {
    if (simRunning) return
    simRunning = true
    socket.emit('health:synthetic-start', { message: 'Running 30s synthetic race simulation...', ts: Date.now() })
    // simulate stress
    const stress = setInterval(() => {
      pipelineState.consumerLagMs = 800 + Math.random() * 600
      pipelineState.ingestRateHz = 1000
      pipelineState.uptimePct = 99.96 + Math.random() * 0.03
    }, 1000)
    setTimeout(() => {
      clearInterval(stress)
      pipelineState.consumerLagMs = 400
      pipelineState.primaryHealthy = true
      pipelineState.secondaryBufferArmed = false
      simRunning = false
      socket.emit('health:synthetic-done', {
        message: 'Synthetic race complete. All channels nominal. Zero data loss.',
        result: { checksPassed: 14, checksFailed: 0, throughputHz: 6000, latencyP99: 412 },
        ts: Date.now(),
      })
    }, 3000)
  })

  // run playbook action
  socket.on('playbook:run', (payload: { playbook: string }) => {
    const t0 = Date.now()
    const steps: string[] = []
    if (payload.playbook === 'kill-duplicate-workers') {
      steps.push('Detected 3 duplicate Spark workers')
      steps.push('Terminated worker-7, worker-9')
      steps.push('Consumer lag 14.2s → 0.4s')
      pipelineState.consumerLagMs = 400
      pipelineState.primaryHealthy = true
      pipelineState.secondaryBufferArmed = false
    } else if (payload.playbook === 'failover-secondary') {
      steps.push('Primary ingest pod CrashLoop detected')
      steps.push('Promoted secondary Kafka buffer')
      steps.push('Replayed 4.2s buffered samples')
      steps.push('Zero data loss confirmed')
      pipelineState.primaryHealthy = false
      pipelineState.secondaryBufferArmed = true
    } else if (payload.playbook === 'rollback-deploy') {
      steps.push('Detected failed deployment v2.3.8 (4 failed regression tests)')
      steps.push('Auto-reverted to v2.3.7')
      steps.push('Rollback complete in 38s (< 1 min target)')
      steps.push('Notified #f1-devops channel')
    }
    setTimeout(() => {
      socket.emit('playbook:done', { playbook: payload.playbook, steps, durationMs: Date.now() - t0, ts: Date.now() })
    }, 1200)
  })

  socket.on('disconnect', () => {
    console.log(`[WS] client disconnected: ${socket.id}`)
  })
})

// ---------- Broadcast live telemetry to subscribers (10 Hz) ----------
setInterval(() => {
  const batch = drivers.map((d) => ({
    code: d.code,
    lap: d.lap,
    lapProgress: Math.round(d.lapProgress * 1000) / 1000,
    sector: d.sector,
    channels: Object.fromEntries(
      Object.entries(d.channels).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    ts: Date.now(),
  }))
  io.to('telemetry').emit('telemetry:tick', batch)
}, 100)

// Spark aggregation broadcast (every 5s)
setInterval(() => {
  io.emit('spark:aggregation', {
    lastRun: aggregations.lastRun,
    windows: aggregations.windows.map((w) => ({
      ...w,
      points: w.points.slice(-15),
    })),
  })
}, 5000)

// Pipeline state broadcast (every 3s)
setInterval(() => {
  // small jitter
  pipelineState.consumerLagMs = Math.max(200, pipelineState.consumerLagMs + (Math.random() - 0.5) * 80)
  if (pipelineState.consumerLagMs > 5000) pipelineState.consumerLagMs = 5000
  io.emit('pipeline:state', { ...pipelineState })
}, 3000)

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`🏎️  F1 Telemetry Streaming Service (Kafka+Spark sim) running on port ${PORT}`)
})

process.on('SIGTERM', () => { clearInterval(tickInterval); clearInterval(sparkInterval); httpServer.close(() => process.exit(0)) })
process.on('SIGINT', () => { clearInterval(tickInterval); clearInterval(sparkInterval); httpServer.close(() => process.exit(0)) })
