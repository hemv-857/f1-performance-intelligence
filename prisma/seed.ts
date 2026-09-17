// Seed Racing Bulls F1 Performance Intelligence Platform
// Run: bun run prisma/seed.ts
import { db } from '../src/lib/db'

async function main() {
  console.log('🛠️  Seeding F1 Performance Intelligence Platform...')

  // Wipe
  await db.telemetrySample.deleteMany()
  await db.deltaRecord.deleteMany()
  await db.lap.deleteMany()
  await db.session.deleteMany()
  await db.channel.deleteMany()
  await db.circuit.deleteMany()
  await db.driver.deleteMany()
  await db.deployment.deleteMany()
  await db.alert.deleteMany()
  await db.dashboardTemplate.deleteMany()
  await db.incidentRun.deleteMany()

  // ---- Channels ----
  const channelDefs = [
    { key: 'speed', label: 'Speed', group: 'engine', unit: 'km/h', sampleHz: 1000, minOk: 0, maxOk: 340 },
    { key: 'throttle', label: 'Throttle', group: 'engine', unit: '%', sampleHz: 1000, minOk: 0, maxOk: 100 },
    { key: 'brake', label: 'Brake Pressure', group: 'brakes', unit: '%', sampleHz: 1000, minOk: 0, maxOk: 100 },
    { key: 'gear', label: 'Gear', group: 'engine', unit: '', sampleHz: 1000, minOk: 1, maxOk: 8 },
    { key: 'rpm', label: 'Engine RPM', group: 'engine', unit: 'rpm', sampleHz: 1000, minOk: 0, maxOk: 13000 },
    { key: 'tire_fl_temp', label: 'Front-Left Tire Temp', group: 'aero', unit: '°C', sampleHz: 100, minOk: 80, maxOk: 120 },
    { key: 'tire_fr_temp', label: 'Front-Right Tire Temp', group: 'aero', unit: '°C', sampleHz: 100, minOk: 80, maxOk: 120 },
    { key: 'tire_rl_temp', label: 'Rear-Left Tire Temp', group: 'aero', unit: '°C', sampleHz: 100, minOk: 80, maxOk: 120 },
    { key: 'tire_rr_temp', label: 'Rear-Right Tire Temp', group: 'aero', unit: '°C', sampleHz: 100, minOk: 80, maxOk: 120 },
    { key: 'suspension_fl', label: 'Suspension FL Travel', group: 'suspension', unit: 'mm', sampleHz: 1000, minOk: -50, maxOk: 50 },
    { key: 'suspension_fr', label: 'Suspension FR Travel', group: 'suspension', unit: 'mm', sampleHz: 1000, minOk: -50, maxOk: 50 },
    { key: 'boost_pressure', label: 'Turbo Boost Pressure', group: 'power_unit', unit: 'bar', sampleHz: 100, minOk: 0, maxOk: 4 },
    { key: 'fuel_flow', label: 'Fuel Flow', group: 'power_unit', unit: 'kg/h', sampleHz: 100, minOk: 0, maxOk: 110 },
    { key: 'drs', label: 'DRS Active', group: 'aero', unit: '', sampleHz: 10, minOk: 0, maxOk: 1 },
  ]
  const channels = {} as Record<string, any>
  for (const c of channelDefs) {
    channels[c.key] = await db.channel.create({ data: c })
  }

  // ---- Drivers ----
  const ourDrivers = [
    { code: 'TSU', name: 'Yuki Tsunoda', team: 'Racing Bulls', number: 22, isRival: false, nationality: 'Japan' },
    { code: 'LAW', name: 'Liam Lawson', team: 'Racing Bulls', number: 30, isRival: false, nationality: 'New Zealand' },
  ]
  const rivals = [
    { code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', number: 1, isRival: true, nationality: 'Netherlands' },
    { code: 'NOR', name: 'Lando Norris', team: 'McLaren', number: 4, isRival: true, nationality: 'United Kingdom' },
    { code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari', number: 16, isRival: true, nationality: 'Monaco' },
    { code: 'RUS', name: 'George Russell', team: 'Mercedes', number: 63, isRival: true, nationality: 'United Kingdom' },
    { code: 'SAI', name: 'Carlos Sainz', team: 'Ferrari', number: 55, isRival: true, nationality: 'Spain' },
    { code: 'PIA', name: 'Oscar Piastri', team: 'McLaren', number: 81, isRival: true, nationality: 'Australia' },
    { code: 'HAM', name: 'Lewis Hamilton', team: 'Mercedes', number: 44, isRival: true, nationality: 'United Kingdom' },
    { code: 'ALO', name: 'Fernando Alonso', team: 'Aston Martin', number: 14, isRival: true, nationality: 'Spain' },
  ]
  const drivers = {} as Record<string, any>
  for (const d of [...ourDrivers, ...rivals]) {
    drivers[d.code] = await db.driver.create({ data: d })
  }

  // ---- Circuits ----
  const circuitDefs = [
    { name: 'Suzuka', country: 'Japan', trackLength: 5.807, lapCount: 53, sectors: 3, corners: 18 },
    { name: 'Singapore', country: 'Singapore', trackLength: 4.940, lapCount: 62, sectors: 3, corners: 19 },
    { name: 'Austin', country: 'USA', trackLength: 5.513, lapCount: 56, sectors: 3, corners: 20 },
  ]
  const circuits = {} as Record<string, any>
  for (const c of circuitDefs) {
    circuits[c.name] = await db.circuit.create({ data: c })
  }

  // ---- Sessions ----
  // For each circuit, create FP1, FP2, FP3, Q, RACE
  const sessionTypes = ['FP1', 'FP2', 'FP3', 'Q', 'RACE']
  const now = new Date()
  const sessions = [] as any[]

  // Round ordering: Suzuka=round1 (past), Singapore=round2 (this weekend - live), Austin=round3 (scheduled)
  const rounds = [
    { circuit: 'Suzuka', round: 1, offsetDays: -21, status: 'completed' },
    { circuit: 'Singapore', round: 2, offsetDays: 0, status: 'live' },
    { circuit: 'Austin', round: 3, offsetDays: 14, status: 'scheduled' },
  ]

  for (const r of rounds) {
    const circuit = circuits[r.circuit]
    for (let i = 0; i < sessionTypes.length; i++) {
      const st = sessionTypes[i]
      const isScheduled = r.status === 'scheduled'
      const date = new Date(now)
      date.setDate(date.getDate() + r.offsetDays + i)
      // status by round: scheduled -> all scheduled; completed -> all completed;
      // live -> FP1/FP2/FP3 completed, Q live, RACE scheduled
      let sessionStatus: string
      if (isScheduled) {
        sessionStatus = 'scheduled'
      } else if (r.status === 'completed') {
        sessionStatus = 'completed'
      } else {
        sessionStatus = i <= 2 ? 'completed' : i === 3 ? 'live' : 'scheduled'
      }
      const session = await db.session.create({
        data: {
          circuitId: circuit.id,
          round: r.round,
          type: st,
          date,
          airTemp: 22 + Math.random() * 8,
          trackTemp: 28 + Math.random() * 12,
          condition: 'dry',
          status: sessionStatus,
        },
      })
      sessions.push({ session, circuit: r.circuit, type: st, round: r.round, status: session.status })
    }
  }

  // ---- Laps + telemetry ----
  // Generate laps for our drivers + key rivals in completed sessions only
  // To keep DB manageable: generate ~15 laps per driver per session,
  // but generate full telemetry samples only for ~3 reference laps per driver per session.
  const allDriverCodes = [...ourDrivers.map(d => d.code), ...rivals.slice(0, 4).map(d => d.code)] // TSU,LAW,VER,NOR,LEC,RUS
  const tireCompounds = ['soft', 'medium', 'hard']

  // Per-circuit base lap time (ms) and corner profile (distance fractions where braking occurs)
  const circuitProfile = {
    Suzuka: { baseMs: 95000, corners: [0.04, 0.12, 0.18, 0.24, 0.33, 0.42, 0.50, 0.56, 0.62, 0.68, 0.75, 0.82, 0.88, 0.94] },
    Singapore: { baseMs: 103000, corners: [0.03, 0.08, 0.14, 0.20, 0.26, 0.32, 0.38, 0.44, 0.50, 0.55, 0.60, 0.66, 0.72, 0.78, 0.84, 0.90, 0.95] },
    Austin: { baseMs: 93000, corners: [0.05, 0.14, 0.22, 0.30, 0.40, 0.48, 0.55, 0.62, 0.70, 0.78, 0.85, 0.92] },
  } as any

  const driverSkill = {
    VER: 0.997, LEC: 0.999, NOR: 0.998, RUS: 0.996, SAI: 0.995, PIA: 0.997, HAM: 0.995, ALO: 0.993,
    TSU: 0.992, LAW: 0.990,
  } as any

  // Telemetry generator: produce ~120 distance samples across a lap for a channel
  const SAMPLES_PER_LAP = 120
  function genTelemetry(channelKey: string, distanceFrac: number, cornerFracs: number[], driverCode: string, baseMs: number) {
    // distanceFrac: 0..1 position on track
    const nearestCorner = cornerFracs.reduce((min: number, cf: number) => {
      const d = Math.abs(cf - distanceFrac)
      return d < Math.abs(min - distanceFrac) ? cf : min
    }, cornerFracs[0])
    const distToCorner = Math.abs(nearestCorner - distanceFrac)
    const isBraking = distToCorner < 0.03
    const isApex = distToCorner < 0.012
    const isStraight = distToCorner > 0.06

    const skill = driverSkill[driverCode] ?? 0.99
    const noise = () => (Math.random() - 0.5) * 2

    switch (channelKey) {
      case 'speed': {
        if (isStraight) return 280 + 50 * skill + noise() * 8
        if (isBraking && !isApex) return 200 - 80 * (0.03 - distToCorner) / 0.03 + noise() * 6
        if (isApex) return 90 + 40 * skill + noise() * 5
        return 140 + 80 * (distToCorner - 0.012) / 0.05 + noise() * 6
      }
      case 'throttle': {
        if (isStraight) return 100
        if (isApex) return 20 + noise() * 8
        if (isBraking) return 0
        return 60 + noise() * 10
      }
      case 'brake': {
        if (isBraking && !isApex) return 70 + noise() * 15
        return 0 + Math.max(0, noise() * 3)
      }
      case 'gear': {
        const v = channelKey // placeholder
        if (isStraight) return 8
        if (isApex) return 3
        if (isBraking) return 5
        return 6
      }
      case 'rpm': {
        const gear = isStraight ? 8 : isApex ? 3 : isBraking ? 5 : 6
        return Math.min(12500, 1500 + gear * 1300 + noise() * 400)
      }
      case 'tire_fl_temp':
      case 'tire_fr_temp':
      case 'tire_rl_temp':
      case 'tire_rr_temp': {
        // front tires hotter in braking/cornering; rear hotter on straights/acceleration
        const isFront = channelKey.includes('fl') || channelKey.includes('fr')
        const isLeft = channelKey.includes('fl') || channelKey.includes('rl')
        const base = 95
        const cornerHeat = isApex ? 12 : isBraking ? 8 : 0
        const sideBias = (cornerFracs.length % 2 === 0) ? (isLeft ? 3 : -3) : 0
        return base + cornerHeat + sideBias + noise() * 2 + (isFront ? (isBraking ? 5 : 0) : (isStraight ? 4 : 0))
      }
      case 'suspension_fl':
      case 'suspension_fr': {
        if (isApex) return -22 + noise() * 4 // compression
        if (isBraking) return -8 + noise() * 3
        return -2 + noise() * 2
      }
      case 'boost_pressure': {
        return 2.5 + 0.8 * skill + (isStraight ? 0.4 : 0) + noise() * 0.1
      }
      case 'fuel_flow': {
        if (isStraight) return 100 + noise() * 5
        if (isApex) return 40 + noise() * 8
        if (isBraking) return 10 + noise() * 4
        return 70 + noise() * 6
      }
      case 'drs': {
        return isStraight && distanceFrac > 0.5 ? 1 : 0
      }
      default:
        return 50 + noise() * 5
    }
  }

  let lapCounter = 0
  let sampleCounter = 0
  for (const s of sessions) {
    if (s.status !== 'completed' && s.status !== 'live') continue
    const profile = circuitProfile[s.circuit as keyof typeof circuitProfile]
    if (!profile) continue
    const trackLenM = Math.round(profile.baseMs * 0.001 * 300 * 1) // not used directly; we use distance fraction
    const sessionDriverPool = s.type === 'RACE' ? allDriverCodes : allDriverCodes
    for (const code of sessionDriverPool) {
      const driver = drivers[code]
      const skill = driverSkill[code] ?? 0.99
      const lapCount = s.type === 'Q' ? 12 : s.type === 'RACE' ? 20 : 14
      let bestMs = Infinity
      const lapIds: string[] = []
      for (let li = 1; li <= lapCount; li++) {
        // lap time: base + tire deg + traffic + random; our drivers slightly slower
        const deg = li * 0.4 // tire deg per lap (ms)
        const traffic = s.type === 'RACE' ? Math.random() * 300 : 0
        const compound = tireCompounds[li % tireCompounds.length]
        const compoundAdj = compound === 'soft' ? -300 : compound === 'hard' ? 400 : 0
        const lapMs = Math.round(profile.baseMs / skill + deg + traffic + compoundAdj + (Math.random() - 0.5) * 600)
        // sectors
        const s1 = Math.round(lapMs * (0.32 + (Math.random() - 0.5) * 0.02))
        const s2 = Math.round(lapMs * (0.35 + (Math.random() - 0.5) * 0.02))
        const s3 = lapMs - s1 - s2
        const isValid = Math.random() > 0.08
        const isFastest = false // set later
        const lap = await db.lap.create({
          data: {
            sessionId: s.session.id,
            driverId: driver.id,
            lapNumber: li,
            lapTimeMs: lapMs,
            sector1Ms: s1,
            sector2Ms: s2,
            sector3Ms: s3,
            tireCompound: compound,
            tireTempAvg: 95 + li * 0.6 + (Math.random() - 0.5) * 4,
            fuelKg: Math.max(0, 110 - li * 1.2),
            drsCount: Math.round(Math.random() * 4),
            isValid,
            isFastest,
          },
        })
        lapIds.push(lap.id)
        if (lapMs < bestMs) bestMs = lapMs
        lapCounter++
      }
      // mark fastest lap
      const fastest = await db.lap.findFirst({
        where: { sessionId: s.session.id, driverId: driver.id, isValid: true },
        orderBy: { lapTimeMs: 'asc' },
      })
      if (fastest) await db.lap.update({ where: { id: fastest.id }, data: { isFastest: true } })

      // Generate full telemetry for 3 reference laps: fastest, an early lap, a late lap
      const refLaps = await db.lap.findMany({
        where: { sessionId: s.session.id, driverId: driver.id },
        orderBy: { lapTimeMs: 'asc' },
        take: 3,
      })
      for (const refLap of refLaps) {
        const channelKeys = ['speed', 'throttle', 'brake', 'gear', 'rpm', 'tire_fl_temp', 'tire_fr_temp', 'tire_rl_temp', 'tire_rr_temp', 'suspension_fl', 'suspension_fr', 'boost_pressure', 'fuel_flow', 'drs']
        for (const ck of channelKeys) {
          const ch = channels[ck]
          if (!ch) continue
          const data: any[] = []
          for (let i = 0; i < SAMPLES_PER_LAP; i++) {
            const distFrac = i / SAMPLES_PER_LAP
            const value = genTelemetry(ck, distFrac, profile.corners, code, profile.baseMs)
            data.push({
              lapId: refLap.id,
              channelId: ch.id,
              distanceM: Math.round(distFrac * profile.baseMs * 0.3), // ~ distance in m
              value,
              ts: Math.round(distFrac * refLap.lapTimeMs),
            })
          }
          await db.telemetrySample.createMany({ data })
          sampleCounter += SAMPLES_PER_LAP
        }
      }
    }
  }
  console.log(`   ✓ Generated ${lapCounter} laps, ${sampleCounter} telemetry samples`)

  // ---- Delta records: our drivers vs rivals ----
  for (const s of sessions) {
    if (s.status !== 'completed' && s.status !== 'live') continue
    const ourCodes = ['TSU', 'LAW']
    const rivalCodes = ['VER', 'NOR', 'LEC']
    for (const oc of ourCodes) {
      const ourLaps = await db.lap.findMany({ where: { sessionId: s.session.id, driverId: drivers[oc].id, isValid: true }, orderBy: { lapNumber: 'asc' } })
      for (const rc of rivalCodes) {
        const rivalLaps = await db.lap.findMany({ where: { sessionId: s.session.id, driverId: drivers[rc].id, isValid: true }, orderBy: { lapNumber: 'asc' } })
        const n = Math.min(ourLaps.length, rivalLaps.length)
        for (let li = 0; li < n; li++) {
          const delta = ourLaps[li].lapTimeMs - rivalLaps[li].lapTimeMs // positive = slower
          await db.deltaRecord.create({
            data: {
              sessionId: s.session.id,
              driverId: drivers[oc].id,
              rivalId: drivers[rc].id,
              lapNumber: ourLaps[li].lapNumber,
              deltaMs: delta,
              channelKey: null,
            },
          })
          // sector deltas
          for (let sec = 1; sec <= 3; sec++) {
            const oS = sec === 1 ? ourLaps[li].sector1Ms : sec === 2 ? ourLaps[li].sector2Ms : ourLaps[li].sector3Ms
            const rS = sec === 1 ? rivalLaps[li].sector1Ms : sec === 2 ? rivalLaps[li].sector2Ms : rivalLaps[li].sector3Ms
            if (oS != null && rS != null) {
              await db.deltaRecord.create({
                data: {
                  sessionId: s.session.id,
                  driverId: drivers[oc].id,
                  rivalId: drivers[rc].id,
                  lapNumber: ourLaps[li].lapNumber,
                  deltaMs: oS - rS,
                  sector: sec,
                  channelKey: null,
                },
              })
            }
          }
          // channel deltas for brake temp on T3 (simulate the "brake temp 15C higher on Turn 3" example)
          const ourBrakeSamples = await db.telemetrySample.findMany({
            where: { lapId: ourLaps[li].id, channel: { key: 'tire_fl_temp' } },
            orderBy: { distanceM: 'asc' },
          })
          const rivalBrakeSamples = await db.telemetrySample.findMany({
            where: { lapId: rivalLaps[li].id, channel: { key: 'tire_fl_temp' } },
            orderBy: { distanceM: 'asc' },
          })
          // find samples near "Turn 3" (~0.18 distance fraction => distanceM ~ 0.18 * baseMs * 0.3
          const t3Dist = Math.round(0.18 * 95000 * 0.3)
          const ourT3 = ourBrakeSamples.find(s => Math.abs(s.distanceM - t3Dist) < 1500)
          const rivalT3 = rivalBrakeSamples.find(s => Math.abs(s.distanceM - t3Dist) < 1500)
          if (ourT3 && rivalT3) {
            await db.deltaRecord.create({
              data: {
                sessionId: s.session.id,
                driverId: drivers[oc].id,
                rivalId: drivers[rc].id,
                lapNumber: ourLaps[li].lapNumber,
                deltaMs: ourT3.value - rivalT3.value, // temperature delta
                channelKey: 'tire_fl_temp',
                sector: 1,
              },
            })
          }
        }
      }
    }
  }
  console.log(`   ✓ Generated delta records`)

  // ---- Deployments ----
  const depDefs = [
    { version: 'v2.4.0', feature: 'Corner-specific brake temp diff highlighting', environment: 'production', canaryPct: 100, status: 'success', triggeredBy: 'ci-bot', commitSha: 'a1f3c9d', testsPassed: 248, testsFailed: 0, regressionScore: 0.97 },
    { version: 'v2.4.1', feature: 'Low-code 3D track view widget', environment: 'canary', canaryPct: 10, status: 'running', triggeredBy: 'l.lawson', commitSha: 'b2e4f1a', testsPassed: 261, testsFailed: 0, regressionScore: 0.95 },
    { version: 'v2.3.9', feature: 'Snowflake query caching (sub-2s)', environment: 'production', canaryPct: 100, status: 'success', triggeredBy: 'ci-bot', commitSha: '9c0d2e7', testsPassed: 240, testsFailed: 0, regressionScore: 0.99 },
    { version: 'v2.3.8', feature: 'Canary 50% rollout framework', environment: 'production', canaryPct: 100, status: 'rolled_back', triggeredBy: 'ci-bot', commitSha: '7d8a1b3', testsPassed: 232, testsFailed: 4, regressionScore: 0.71 },
    { version: 'v2.4.2-rc', feature: 'Kafka failover auto-promote', environment: 'staging', canaryPct: 0, status: 'pending', triggeredBy: 'devops', commitSha: 'c3f5a2b', testsPassed: 0, testsFailed: 0, regressionScore: null },
  ]
  for (const d of depDefs) {
    await db.deployment.create({ data: d })
  }

  // ---- Alerts ----
  const alDefs = [
    { severity: 'critical', source: 'kafka', title: 'Telemetry consumer lag spiking', message: 'telemetry-f1 topic consumer lag at 14.2s on worker-7. Auto-scaling triggered.', status: 'active', autoAction: 'kill-duplicate-workers', driverId: null },
    { severity: 'warning', source: 'spark', title: 'Spark job checkpoint delay', message: 'Aggregation job agg-5s-lap checkpoint write 2.1s (threshold 1.5s). Secondary buffer armed.', status: 'active', autoAction: null, driverId: null },
    { severity: 'info', source: 'snowflake', title: 'Warehouse auto-suspend', message: 'WH_F1_ANALYTICS auto-suspended after 240s idle. Resume on next query.', status: 'resolved', autoAction: null, driverId: null },
    { severity: 'warning', source: 'telemetry', title: 'TSU brake temp Turn 3 +15°C vs VER', message: 'Front-left brake temp on T3 is 15°C above rival baseline across last 3 laps. Aero diff suspected.', status: 'active', autoAction: null, driverId: drivers['TSU'].id },
    { severity: 'critical', source: 'k8s', title: 'Pod f1-telemetry-ingest-7d restart loop', message: 'CrashLoopBackOff on ingest pod. Failover to secondary buffer. Zero data loss confirmed.', status: 'acknowledged', autoAction: 'failover-secondary', driverId: null },
    { severity: 'info', source: 'telemetry', title: 'LAW tire deg curve nominal', message: 'Medium compound deg 0.04s/lap — within target envelope.', status: 'resolved', autoAction: null, driverId: drivers['LAW'].id },
  ]
  for (const a of alDefs) {
    await db.alert.create({ data: a })
  }

  // ---- Dashboard templates ----
  const tplDefs = [
    { name: 'Qualifying Delta vs Rivals', owner: 'aero-team', discipline: 'aero', querySql: 'SELECT l.lap_number, l.lap_time_ms - {{rival_lap_time_ms}} AS delta_ms FROM laps l WHERE l.session_id = {{session_id}} AND l.driver_id = {{driver_id}} ORDER BY l.lap_number', chartType: 'line', params: '{"session_id":"string","driver_id":"string","rival_lap_time_ms":"int"}', schedule: '0 */15 * * *', isFavorite: true },
    { name: 'Tire Degradation Curves', owner: 'strategy', discipline: 'strategy', querySql: 'SELECT lap_number, tire_temp_avg FROM laps WHERE session_id = {{session_id}} AND driver_id = {{driver_id}} AND tire_compound = {{compound}} ORDER BY lap_number', chartType: 'line', params: '{"session_id":"string","driver_id":"string","compound":"string"}', schedule: null, isFavorite: true },
    { name: 'Brake Temp Heatmap by Corner', owner: 'chassis-team', discipline: 'chassis', querySql: 'SELECT distance_m, AVG(value) FROM telemetry_samples ts JOIN channels c ON c.id = ts.channel_id WHERE c.key = {{channel}} AND ts.lap_id IN ({{lap_ids}}) GROUP BY distance_m', chartType: 'heatmap', params: '{"channel":"string","lap_ids":"string"}', schedule: null, isFavorite: false },
    { name: 'Fuel Consumption Trend', owner: 'strategy', discipline: 'strategy', querySql: 'SELECT lap_number, fuel_kg FROM laps WHERE session_id = {{session_id}} AND driver_id = {{driver_id}} ORDER BY lap_number', chartType: 'line', params: '{"session_id":"string","driver_id":"string"}', schedule: '0 */5 * * *', isFavorite: true },
    { name: '3D Track Speed Trace', owner: 'aero-team', discipline: 'aero', querySql: 'SELECT distance_m, value FROM telemetry_samples ts JOIN channels c ON c.id = ts.channel_id WHERE c.key = \'speed\' AND ts.lap_id = {{lap_id}} ORDER BY distance_m', chartType: 'track3d', params: '{"lap_id":"string"}', schedule: null, isFavorite: false },
    { name: 'Sector Time Gauge', owner: 'strategy', discipline: 'strategy', querySql: 'SELECT sector1_ms, sector2_ms, sector3_ms FROM laps WHERE id = {{lap_id}}', chartType: 'gauge', params: '{"lap_id":"string"}', schedule: null, isFavorite: false },
  ]
  for (const t of tplDefs) {
    await db.dashboardTemplate.create({ data: t })
  }

  // ---- Incident runs ----
  const incDefs = [
    { playbook: 'kill-duplicate-workers', trigger: 'latency-spike', status: 'resolved', actionsJson: '["detected 3 duplicate spark workers","terminated worker-7, worker-9","lag dropped 14.2s -> 0.4s"]', durationMs: 38000 },
    { playbook: 'failover-secondary', trigger: 'data-loss-risk', status: 'resolved', actionsJson: '["primary ingest pod CrashLoop","promoted secondary kafka buffer","replayed 4.2s buffered samples","zero data loss confirmed"]', durationMs: 71000 },
    { playbook: 'rollback-deploy', trigger: 'deploy-failed', status: 'resolved', actionsJson: '["v2.3.8 canary failed 4 regression tests","auto-reverted to v2.3.7","<1 min rollback","notified channel #f1-devops"]', durationMs: 48000 },
  ]
  for (const i of incDefs) {
    await db.incidentRun.create({ data: i })
  }

  console.log('✅ Seed complete.')
  const counts = {
    drivers: await db.driver.count(),
    channels: await db.channel.count(),
    circuits: await db.circuit.count(),
    sessions: await db.session.count(),
    laps: await db.lap.count(),
    samples: await db.telemetrySample.count(),
    deltas: await db.deltaRecord.count(),
    deployments: await db.deployment.count(),
    alerts: await db.alert.count(),
    templates: await db.dashboardTemplate.count(),
    incidents: await db.incidentRun.count(),
  }
  console.log(counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
