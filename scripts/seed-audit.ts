// Seed plausible historical audit log entries for the F1 Performance Intelligence Platform.
// Usage:  bun run scripts/seed-audit.ts
//
// Idempotent-ish: clears all existing AuditLog rows first, then inserts the seed set
// with timestamps relative to "now" so the relative-time labels ("2h ago") look fresh.

import { db } from '../src/lib/db'

interface SeedEntry {
  action: string
  category: string
  actor: string
  target: string | null
  detail: string | null
  severity: string
  meta?: Record<string, unknown>
  /** Minutes-ago offset for createdAt. */
  minutesAgo: number
}

const NOW = Date.now()
const MIN = 60 * 1000

const SEED: SeedEntry[] = [
  {
    action: 'playbook_run',
    category: 'ops',
    actor: 'strategist',
    target: 'kill-duplicate-workers',
    detail: 'Telemetry pipeline latency spiked to 6.4s. Terminated 3 duplicate Spark executors. Lag dropped to <1s in 42s.',
    severity: 'success',
    meta: { trigger: 'latency-spike', durationMs: 42000, executorsKilled: 3 },
    minutesAgo: 120,
  },
  {
    action: 'deploy_promote',
    category: 'devops',
    actor: 'ci-bot',
    target: 'v2.4.1',
    detail: 'Canary promotion 10% → 50% → 100%. Regression score 0.91 (threshold 0.80). All SLOs green.',
    severity: 'success',
    meta: { version: 'v2.4.1', canaryPct: 100, regressionScore: 0.91, commitSha: 'a3f1c20' },
    minutesAgo: 60 * 24,
  },
  {
    action: 'deploy_rollback',
    category: 'devops',
    actor: 'devops-bot',
    target: 'v2.3.8',
    detail: 'Auto-rollback to v2.3.7 triggered — canary failed regression tests (4 failures, regression 0.62). Rollback completed in 47s.',
    severity: 'warning',
    meta: { version: 'v2.3.8', revertedTo: 'v2.3.7', durationMs: 47000, testsFailed: 4 },
    minutesAgo: 60 * 48,
  },
  {
    action: 'ai_query',
    category: 'ai',
    actor: 'aero-team',
    target: null,
    detail: 'Why are we slower in S2? AI identified TSU losing 0.18s in Turns 5-7 (mid-corner understeer, front-left tire 9°C below optimal).',
    severity: 'info',
    meta: { model: 'gpt-4o', contextChars: 8421, sessionId: 'r2-singapore-q' },
    minutesAgo: 30,
  },
  {
    action: 'pdf_export',
    category: 'telemetry',
    actor: 'strategist',
    target: 'R2 Singapore Q report',
    detail: 'PDF report generated — 6 pages, TSU vs VER delta-P + channel diffs + recommendations.',
    severity: 'info',
    meta: { pages: 6, sessionId: 'r2-singapore-q', sizeKb: 312 },
    minutesAgo: 60,
  },
  {
    action: 'template_run',
    category: 'strategy',
    actor: 'strategy',
    target: 'Tire Degradation Curves',
    detail: 'Low-code template "Tire Degradation Curves" executed on R2-Singapore-Q. Soft compound loses 0.04s/lap after lap 8.',
    severity: 'info',
    meta: { templateId: 'tire-deg-curves', chartType: 'line', rowsReturned: 48 },
    minutesAgo: 45,
  },
  {
    action: 'anomaly_ack',
    category: 'telemetry',
    actor: 'ai-engineer',
    target: 'TSU tire_fl_temp',
    detail: 'Auto-acknowledged anomaly: TSU tire_fl_temp 118°C (range 80–110°C). AI diagnosed under-inflation + aggressive Turn 3 kerb usage. Recommended +0.1 bar FL.',
    severity: 'critical',
    meta: { driverCode: 'TSU', channel: 'tire_fl_temp', value: 118, rangeMin: 80, rangeMax: 110 },
    minutesAgo: 15,
  },
  {
    action: 'synthetic_race',
    category: 'ops',
    actor: 'devops',
    target: 'pre-race health check',
    detail: 'Synthetic race simulation: 28 checks passed, 0 failed, p99 ingest latency 41ms. Pipeline race-ready.',
    severity: 'success',
    meta: { checksPassed: 28, checksFailed: 0, latencyP99: 41 },
    minutesAgo: 180,
  },
  {
    action: 'session_select',
    category: 'telemetry',
    actor: 'strategist',
    target: 'R2 Singapore Q',
    detail: 'Session selected in Telemetry Viewer. Loaded 196 laps · 87k telemetry samples for the Qualifying session.',
    severity: 'info',
    meta: { sessionId: 'r2-singapore-q', lapCount: 196, sampleCount: 87432 },
    minutesAgo: 60,
  },
  {
    action: 'playbook_run',
    category: 'system',
    actor: 'system',
    target: 'failover-secondary',
    detail: 'Auto-triggered failover to secondary Kafka buffer — primary ingest pod CrashLoop. Zero data loss. Buffered 12,481 samples replayed.',
    severity: 'critical',
    meta: { trigger: 'data-loss-risk', samplesReplayed: 12481, durationMs: 18500 },
    minutesAgo: 60 * 48,
  },
]

async function main() {
  console.log(`Clearing existing AuditLog rows...`)
  const cleared = await db.auditLog.deleteMany({})
  console.log(`  deleted ${cleared.count} rows`)

  console.log(`Inserting ${SEED.length} seed entries...`)
  for (const e of SEED) {
    await db.auditLog.create({
      data: {
        action: e.action,
        category: e.category,
        actor: e.actor,
        target: e.target,
        detail: e.detail,
        severity: e.severity,
        metaJson: e.meta ? JSON.stringify(e.meta) : null,
        createdAt: new Date(NOW - e.minutesAgo * MIN),
      },
    })
  }

  const total = await db.auditLog.count()
  console.log(`Done. AuditLog now holds ${total} entries.`)
  await db.$disconnect()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
