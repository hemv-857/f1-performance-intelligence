import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/devops/health — service health dashboard
// Returns status of all platform services + uptime + active alert counts.
export async function GET() {
  const alertCounts = {
    critical: await db.alert.count({ where: { severity: 'critical', status: { in: ['active', 'acknowledged'] } } }),
    warning: await db.alert.count({ where: { severity: 'warning', status: { in: ['active', 'acknowledged'] } } }),
    info: await db.alert.count({ where: { severity: 'info', status: { in: ['active', 'acknowledged'] } } }),
  }

  // Synthetic but stable service registry (matches the WS service + simulated infra)
  const services = [
    { name: 'telemetry-ingest', component: 'Kafka', uptimePct: 99.97, latencyMs: 412, rps: 6000, status: 'healthy', instances: 6, region: 'race-edge' },
    { name: 'spark-streaming', component: 'Spark', uptimePct: 99.95, latencyMs: 4800, rps: 1200, status: 'healthy', instances: 4, region: 'race-edge' },
    { name: 'secondary-buffer', component: 'Kafka (failover)', uptimePct: 100, latencyMs: 210, rps: 0, status: 'armed', instances: 2, region: 'race-edge' },
    { name: 'snowflake-wh', component: 'Snowflake', uptimePct: 99.99, latencyMs: 1840, rps: 42, status: 'healthy', instances: 3, region: 'multi-region' },
    { name: 'dbt-runner', component: 'dbt Cloud', uptimePct: 99.93, latencyMs: 9200, rps: 8, status: 'healthy', instances: 2, region: 'multi-region' },
    { name: 'frontend-nextjs', component: 'Next.js', uptimePct: 99.99, latencyMs: 96, rps: 240, status: 'healthy', instances: 4, region: 'multi-region' },
    { name: 'socketio-realtime', component: 'Socket.IO', uptimePct: 99.96, latencyMs: 38, rps: 580, status: 'healthy', instances: 2, region: 'race-edge' },
    { name: 'k8s-control', component: 'Kubernetes', uptimePct: 99.98, latencyMs: 120, rps: 0, status: 'healthy', instances: 1, region: 'race-edge' },
  ]

  const cpuAvg = 38 + Math.random() * 8
  const memAvg = 56 + Math.random() * 6
  const netThroughputGbps = 4.2 + Math.random() * 0.8

  return NextResponse.json({
    services,
    resourceAverages: {
      cpuPct: Math.round(cpuAvg * 10) / 10,
      memPct: Math.round(memAvg * 10) / 10,
      networkGbps: Math.round(netThroughputGbps * 100) / 100,
    },
    alertCounts,
    pipelineUptimePct: 99.97,
    dataLossGuarantee: true,
    lastHealthCheck: new Date().toISOString(),
    successMetrics: {
      deploymentsPerRaceWeekend: 2,
      targetPipelineUptime: 99.9,
      actualPipelineUptime: 99.97,
      targetQueryLatencyMs: 2000,
      avgQueryLatencyMs: 1180,
      adoptionPct: 100,
      weeksToNewFeature: 0.3, // vs 3 currently
    },
  })
}
