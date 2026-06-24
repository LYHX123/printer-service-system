import { prisma } from "@/lib/prisma"
import type { Customer, JobStatus, QuotationStatus, ServiceType, User } from "@/types"

export interface DateRangeFilter {
  from?: string
  to?: string
}

function dateRangeWhere({ from, to }: DateRangeFilter) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  }
}

// ─── Repair report list ────────────────────────────────────────────────────

export type RepairReportListItem = {
  id: string
  jobId: string
  jobNumber: string
  status: JobStatus
  serviceType: ServiceType
  createdAt: Date
  completedAt: Date | null
  totalCost: number
  customer: Pick<Customer, "id" | "name" | "code" | "companyName">
  assignedTo: Pick<User, "id" | "name">
}

export async function getRepairReportList(
  companyId: string,
  filters: DateRangeFilter & { customerId?: string; engineerId?: string; status?: string }
): Promise<RepairReportListItem[]> {
  const { from, to, customerId, engineerId, status } = filters
  const reports = await prisma.repairReport.findMany({
    where: {
      job: {
        companyId,
        ...(customerId ? { customerId } : {}),
        ...(engineerId ? { assignedToId: engineerId } : {}),
        ...(status ? { status: status as JobStatus } : {}),
      },
      ...(from || to ? { createdAt: dateRangeWhere({ from, to }) } : {}),
    },
    select: {
      id: true,
      createdAt: true,
      labourCost: true,
      partsCost: true,
      job: {
        select: {
          id: true,
          jobNumber: true,
          status: true,
          serviceType: true,
          completedAt: true,
          totalCost: true,
          customer: { select: { id: true, name: true, code: true, companyName: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return reports.map((r) => ({
    id: r.id,
    jobId: r.job.id,
    jobNumber: r.job.jobNumber,
    status: r.job.status,
    serviceType: r.job.serviceType,
    createdAt: r.createdAt,
    completedAt: r.job.completedAt,
    totalCost: Number(r.job.totalCost),
    customer: r.job.customer,
    assignedTo: r.job.assignedTo,
  }))
}

// ─── Quotation report list ─────────────────────────────────────────────────

export type QuotationReportListItem = {
  id: string
  quotationNumber: string
  status: QuotationStatus
  createdAt: Date
  totalCost: number
  customer: Pick<Customer, "id" | "name" | "code" | "companyName">
  createdBy: Pick<User, "id" | "name">
}

export async function getQuotationReportList(
  companyId: string,
  filters: DateRangeFilter & { customerId?: string; engineerId?: string; status?: string }
): Promise<QuotationReportListItem[]> {
  const { from, to, customerId, engineerId, status } = filters
  const quotations = await prisma.quotation.findMany({
    where: {
      companyId,
      ...(customerId ? { customerId } : {}),
      ...(engineerId ? { createdById: engineerId } : {}),
      ...(status ? { status: status as QuotationStatus } : {}),
      ...(from || to ? { createdAt: dateRangeWhere({ from, to }) } : {}),
    },
    select: {
      id: true,
      quotationNumber: true,
      status: true,
      createdAt: true,
      totalCost: true,
      customer: { select: { id: true, name: true, code: true, companyName: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return quotations.map((q) => ({ ...q, totalCost: Number(q.totalCost) }))
}

// ─── Reports overview ───────────────────────────────────────────────────────

export async function getReportsOverview(companyId: string) {
  const [repairReportCount, quotationCount, jobCount, deliveredCount] = await Promise.all([
    prisma.repairReport.count({ where: { job: { companyId } } }),
    prisma.quotation.count({ where: { companyId } }),
    prisma.serviceJob.count({ where: { companyId } }),
    prisma.serviceJob.count({ where: { companyId, status: "DELIVERED" } }),
  ])

  return { repairReportCount, quotationCount, jobCount, deliveredCount }
}

// ─── Engineer productivity ─────────────────────────────────────────────────

export type EngineerProductivity = {
  engineer: Pick<User, "id" | "name" | "email" | "role">
  jobsAssigned: number
  jobsCompleted: number
  avgCompletionDays: number | null
  revenueGenerated: number
  partsUsed: number
}

export async function getEngineerProductivity(
  companyId: string,
  filters: DateRangeFilter & { engineerId?: string }
): Promise<EngineerProductivity[]> {
  const { from, to, engineerId } = filters
  const receivedRange = dateRangeWhere({ from, to })
  const completedRange = dateRangeWhere({ from, to })

  const engineers = await prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      role: { in: ["ENGINEER", "MANAGER", "ADMIN"] },
      ...(engineerId ? { id: engineerId } : {}),
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  })

  const results: EngineerProductivity[] = []

  for (const engineer of engineers) {
    const jobsAssigned = await prisma.serviceJob.count({
      where: {
        companyId,
        assignedToId: engineer.id,
        ...(receivedRange ? { receivedDate: receivedRange } : {}),
      },
    })

    const completedJobs = await prisma.serviceJob.findMany({
      where: {
        companyId,
        assignedToId: engineer.id,
        status: "DELIVERED",
        ...(completedRange ? { completedAt: completedRange } : {}),
      },
      select: { id: true, receivedDate: true, completedAt: true, totalCost: true },
    })

    const jobsCompleted = completedJobs.length
    const revenueGenerated = completedJobs.reduce((sum, j) => sum + Number(j.totalCost), 0)
    const avgCompletionDays =
      jobsCompleted > 0
        ? completedJobs.reduce((sum, j) => {
            const diff = j.completedAt!.getTime() - j.receivedDate.getTime()
            return sum + diff / (1000 * 60 * 60 * 24)
          }, 0) / jobsCompleted
        : null

    const partsUsedAgg = await prisma.jobPart.aggregate({
      _sum: { quantity: true },
      where: {
        report: {
          jobId: { in: completedJobs.map((j) => j.id) },
        },
      },
    })

    results.push({
      engineer,
      jobsAssigned,
      jobsCompleted,
      avgCompletionDays,
      revenueGenerated,
      partsUsed: partsUsedAgg._sum.quantity ?? 0,
    })
  }

  return results
}
