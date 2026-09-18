import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Allowed values — used to validate input on POST and to clamp GET filters.
const ALLOWED_ACTIONS = new Set([
  'playbook_run',
  'deploy_promote',
  'deploy_rollback',
  'ai_query',
  'pdf_export',
  'template_run',
  'session_select',
  'anomaly_ack',
  'synthetic_race',
  'manual',
])
const ALLOWED_CATEGORIES = new Set(['devops', 'ai', 'telemetry', 'strategy', 'ops', 'system'])
const ALLOWED_SEVERITIES = new Set(['info', 'success', 'warning', 'critical'])

function parseLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n <= 0) return 50
  return Math.min(n, 200)
}

// GET /api/audit-log?category=&action=&severity=&limit=
// Returns the most recent audit log entries, newest first.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = parseLimit(url.searchParams.get('limit'))
  const categoryParam = url.searchParams.get('category') ?? ''
  const actionParam = url.searchParams.get('action') ?? ''
  const severityParam = url.searchParams.get('severity') ?? ''

  const where: Record<string, string> = {}
  if (categoryParam && ALLOWED_CATEGORIES.has(categoryParam)) where.category = categoryParam
  if (actionParam && ALLOWED_ACTIONS.has(actionParam)) where.action = actionParam
  if (severityParam && ALLOWED_SEVERITIES.has(severityParam)) where.severity = severityParam

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      category: r.category,
      actor: r.actor,
      target: r.target ?? null,
      detail: r.detail ?? null,
      severity: r.severity,
      meta: r.metaJson ? safeParse(r.metaJson) : null,
      createdAt: r.createdAt.toISOString(),
    })),
    count: rows.length,
  })
}

// POST /api/audit-log — body { action, category, actor, target?, detail?, severity?, meta? }
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : ''
  const category = typeof body.category === 'string' ? body.category : ''
  const actor = typeof body.actor === 'string' ? body.actor : ''
  if (!action || !category || !actor) {
    return NextResponse.json(
      { error: 'action, category and actor are required' },
      { status: 400 },
    )
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `unknown category: ${category}` }, { status: 400 })
  }

  const severityRaw = typeof body.severity === 'string' ? body.severity : 'info'
  const severity = ALLOWED_SEVERITIES.has(severityRaw) ? severityRaw : 'info'
  const target = typeof body.target === 'string' && body.target ? body.target : null
  const detail = typeof body.detail === 'string' && body.detail ? body.detail : null
  const metaJson =
    body.meta !== undefined && body.meta !== null ? JSON.stringify(body.meta) : null

  const created = await db.auditLog.create({
    data: {
      action,
      category,
      actor,
      target,
      detail,
      severity,
      metaJson,
    },
  })

  return NextResponse.json(
    {
      entry: {
        id: created.id,
        action: created.action,
        category: created.category,
        actor: created.actor,
        target: created.target,
        detail: created.detail,
        severity: created.severity,
        meta: created.metaJson ? safeParse(created.metaJson) : null,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  )
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
