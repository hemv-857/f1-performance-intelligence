import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/drivers — list drivers
export async function GET() {
  const drivers = await db.driver.findMany({ orderBy: { isRival: 'asc' } })
  return NextResponse.json({
    drivers: drivers.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      team: d.team,
      number: d.number,
      isRival: d.isRival,
      nationality: d.nationality,
    })),
  })
}
