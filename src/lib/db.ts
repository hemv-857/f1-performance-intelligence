import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In dev, the long-lived Node process keeps the PrismaClient instance cached on
// globalThis even after `prisma generate` produces a new client (e.g. when a new
// model is added). Detect that staleness by checking for a known recent model and
// recreate the client if it's missing.
function createClient(): PrismaClient {
  return new PrismaClient({
    log: ['query'],
  })
}

function resolveClient(): PrismaClient {
  const cached = globalForPrisma.prisma
  if (cached && typeof (cached as unknown as { auditLog?: unknown }).auditLog !== 'undefined') {
    return cached
  }
  const fresh = createClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = fresh
  return fresh
}

export const db = resolveClient()