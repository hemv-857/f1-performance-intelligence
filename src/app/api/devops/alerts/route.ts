import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/devops/alerts — all alerts (monitoring)
export async function GET() {
  const alerts = await db.alert.findMany({
    include: { driver: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      source: a.source,
      title: a.title,
      message: a.message,
      status: a.status,
      autoAction: a.autoAction,
      driver: a.driver ? { code: a.driver.code, name: a.driver.name } : null,
      createdAt: a.createdAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString(),
    })),
  })
}

// POST — acknowledge/resolve an alert
export async function POST(req: Request) {
  const { id, action } = await req.json() as { id: string; action: 'acknowledge' | 'resolve' }
  const status = action === 'acknowledge' ? 'acknowledged' : 'resolved'
  const updated = await db.alert.update({
    where: { id },
    data: { status, resolvedAt: action === 'resolve' ? new Date() : null },
  })
  return NextResponse.json({ alert: updated })
}
