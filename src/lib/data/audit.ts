import { prisma } from "@/lib/prisma"
import type { AuditLog } from "@/types"

const DEFAULT_PAGE_SIZE = 50

export interface AuditLogFilters {
  from?: string
  to?: string
  userId?: string
  entityType?: string
  action?: string
  search?: string
  page?: number
  pageSize?: number
}

export type AuditLogEntry = Omit<AuditLog, "metadata"> & {
  metadata: Record<string, unknown> | null
  performedBy: { id: string; name: string }
}

export interface AuditLogPage {
  entries: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function dateRangeWhere(from?: string, to?: string) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  }
}

/**
 * Paginated, filterable, company-scoped Audit Log query — the only place the
 * new Settings > Audit Log page reads from. `search` is a simple contains
 * match across action/entityType/entityId/performer name; it never inspects
 * `metadata` (unstructured JSON, not worth an unindexed scan).
 */
export async function getAuditLogs(companyId: string, filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  const page = filters.page && filters.page > 0 ? Math.floor(filters.page) : 1
  const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.floor(filters.pageSize) : DEFAULT_PAGE_SIZE
  const dateRange = dateRangeWhere(filters.from, filters.to)
  const search = filters.search?.trim()

  const where = {
    companyId,
    ...(filters.userId ? { performedById: filters.userId } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(dateRange ? { createdAt: dateRange } : {}),
    ...(search
      ? {
          OR: [
            { action: { contains: search, mode: "insensitive" as const } },
            { entityType: { contains: search, mode: "insensitive" as const } },
            { entityId: { contains: search, mode: "insensitive" as const } },
            { performedBy: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { performedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    entries: rows.map((r) => ({ ...r, metadata: (r.metadata as Record<string, unknown> | null) ?? null })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getAuditLogEntry(companyId: string, id: string): Promise<AuditLogEntry | null> {
  const row = await prisma.auditLog.findFirst({
    where: { id, companyId },
    include: { performedBy: { select: { id: true, name: true } } },
  })
  if (!row) return null
  return { ...row, metadata: (row.metadata as Record<string, unknown> | null) ?? null }
}

export interface AuditLogFilterOptions {
  users: { id: string; name: string }[]
  entityTypes: string[]
  actions: string[]
}

/**
 * Lean filter-option lists for the Audit Log page's dropdowns. `users` is
 * every user in the company (not just ones with existing log rows) so an
 * admin can filter by anyone; entityTypes/actions come from DISTINCT over
 * the company's actual rows, so old/legacy values show up automatically
 * without needing a hardcoded list.
 */
export async function getAuditLogFilterOptions(companyId: string): Promise<AuditLogFilterOptions> {
  const [users, entityTypeRows, actionRows] = await Promise.all([
    prisma.user.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ where: { companyId }, select: { entityType: true }, distinct: ["entityType"] }),
    prisma.auditLog.findMany({ where: { companyId }, select: { action: true }, distinct: ["action"] }),
  ])

  return {
    users,
    entityTypes: entityTypeRows.map((r) => r.entityType).sort(),
    actions: actionRows.map((r) => r.action).sort(),
  }
}
