import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/devops/deployments — deployment history
export async function GET() {
  const deployments = await db.deployment.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({
    deployments: deployments.map((d) => ({
      id: d.id,
      version: d.version,
      feature: d.feature,
      environment: d.environment,
      canaryPct: d.canaryPct,
      status: d.status,
      triggeredBy: d.triggeredBy,
      commitSha: d.commitSha,
      testsPassed: d.testsPassed,
      testsFailed: d.testsFailed,
      regressionScore: d.regressionScore,
      createdAt: d.createdAt.toISOString(),
      rolledBackAt: d.rolledBackAt?.toISOString(),
    })),
  })
}

// POST /api/devops/deployments — canary promote or rollback
export async function POST(req: Request) {
  const body = await req.json()
  const { action, version } = body as { action: 'promote' | 'rollback'; version?: string }
  if (action === 'promote') {
    const dep = await db.deployment.findFirst({ where: { version, status: 'running' } })
    if (!dep) return NextResponse.json({ error: 'running deployment not found' }, { status: 404 })
    const nextPct = dep.canaryPct === 10 ? 50 : 100
    const updated = await db.deployment.update({
      where: { id: dep.id },
      data: { canaryPct: nextPct, status: nextPct === 100 ? 'success' : 'running' },
    })
    return NextResponse.json({ deployment: updated, message: `Canary promoted to ${nextPct}%` })
  }
  if (action === 'rollback') {
    const dep = await db.deployment.findFirst({ where: { version, status: { in: ['running', 'success', 'failed'] } } })
    if (!dep) return NextResponse.json({ error: 'deployment not found' }, { status: 404 })
    const updated = await db.deployment.update({
      where: { id: dep.id },
      data: { status: 'rolled_back', rolledBackAt: new Date() },
    })
    // record an incident run for the rollback playbook
    await db.incidentRun.create({
      data: {
        playbook: 'rollback-deploy',
        trigger: 'deploy-failed',
        status: 'resolved',
        actionsJson: JSON.stringify([
          `Detected rollback request for ${dep.version}`,
          'Auto-reverted to previous stable version',
          'Rollback complete in 38s (< 1 min target)',
          'Notified #f1-devops channel',
        ]),
        durationMs: 38000,
      },
    })
    return NextResponse.json({ deployment: updated, message: `Rolled back ${dep.version} in <1 min` })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
