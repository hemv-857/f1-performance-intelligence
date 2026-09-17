import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/leaderboard — engineer activity leaderboard
// Aggregates the audit log by actor: counts anomalies caught, playbooks run,
// deploys promoted/rolled back, AI queries, exports. Returns a ranked list.
export async function GET() {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })

  // aggregate by actor
  const byActor = new Map<string, {
    actor: string
    totalActions: number
    anomaliesCaught: number
    playbooksRun: number
    deploysPromoted: number
    deploysRolledBack: number
    aiQueries: number
    exports: number
    lastActive: Date | null
  }>()

  for (const l of logs) {
    const a = byActor.get(l.actor) ?? {
      actor: l.actor,
      totalActions: 0, anomaliesCaught: 0, playbooksRun: 0,
      deploysPromoted: 0, deploysRolledBack: 0, aiQueries: 0, exports: 0,
      lastActive: null,
    }
    a.totalActions += 1
    if (l.action === 'anomaly_ack' || l.action === 'playbook_run' && l.severity === 'critical') a.anomaliesCaught += 1
    if (l.action === 'playbook_run') a.playbooksRun += 1
    if (l.action === 'deploy_promote') a.deploysPromoted += 1
    if (l.action === 'deploy_rollback') a.deploysRolledBack += 1
    if (l.action === 'ai_query') a.aiQueries += 1
    if (l.action === 'pdf_export') a.exports += 1
    if (!a.lastActive || l.createdAt > a.lastActive) a.lastActive = l.createdAt
    byActor.set(l.actor, a)
  }

  // compute a gamification score
  const ranked = Array.from(byActor.values()).map((a) => {
    const score = a.anomaliesCaught * 25 + a.playbooksRun * 15 + a.deploysPromoted * 10 + a.aiQueries * 5 + a.exports * 8 + a.deploysRolledBack * 3
    return { ...a, score }
  }).sort((a, b) => b.score - a.score)

  return NextResponse.json({
    leaderboard: ranked,
    totalActions: logs.length,
  })
}
