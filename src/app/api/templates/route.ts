import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/templates — low-code dashboard templates
export async function GET() {
  const templates = await db.dashboardTemplate.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      owner: t.owner,
      discipline: t.discipline,
      querySql: t.querySql,
      chartType: t.chartType,
      params: JSON.parse(t.params),
      schedule: t.schedule,
      isFavorite: t.isFavorite,
      lastRunAt: t.lastRunAt?.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  })
}

// POST — favorite / save new template
export async function POST(req: Request) {
  const body = await req.json()
  if (body.action === 'favorite') {
    const updated = await db.dashboardTemplate.update({
      where: { id: body.id },
      data: { isFavorite: !body.isFavorite },
    })
    return NextResponse.json({ template: updated })
  }
  if (body.action === 'create') {
    const t = await db.dashboardTemplate.create({
      data: {
        name: body.name,
        owner: body.owner ?? 'engineer',
        discipline: body.discipline ?? 'aero',
        querySql: body.querySql,
        chartType: body.chartType ?? 'line',
        params: JSON.stringify(body.params ?? {}),
        schedule: body.schedule ?? null,
        isFavorite: false,
      },
    })
    return NextResponse.json({ template: t })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
