import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
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
