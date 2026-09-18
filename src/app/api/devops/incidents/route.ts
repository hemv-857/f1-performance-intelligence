import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/devops/incidents — incident playbook run history
export async function GET() {
  const incidents = await db.incidentRun.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({
    incidents: incidents.map((i) => ({
      id: i.id,
      playbook: i.playbook,
      trigger: i.trigger,
      status: i.status,
      actions: JSON.parse(i.actionsJson),
      durationMs: i.durationMs,
      createdAt: i.createdAt.toISOString(),
    })),
  })
}

// POST — record a playbook execution (from the live WS service)
export async function POST(req: Request) {
  const body = await req.json()
  const inc = await db.incidentRun.create({
    data: {
      playbook: body.playbook,
      trigger: body.trigger ?? 'manual',
      status: 'resolved',
      actionsJson: JSON.stringify(body.actions ?? []),
      durationMs: body.durationMs ?? 0,
    },
  })
  return NextResponse.json({ incident: inc })
}
