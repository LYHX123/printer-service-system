import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"

interface LogActivityParams {
  companyId: string
  entityType: string
  entityId: string
  action: string
  performedById: string
  metadata?: Record<string, unknown>
}

/**
 * Fire-and-forget activity log write. Never throws — a logging failure must
 * never roll back or block the mutation it's describing.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...params,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (err) {
    console.error("logActivity failed:", err)
  }
}
