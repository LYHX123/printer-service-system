import { prisma } from "@/lib/prisma"
import { getStockType, type StockType } from "@/lib/stock-types"
import type { Role, QuotationStatus } from "@/types"

// Quotations still "live" — could still become an invoice. Excludes
// REJECTED/CONVERTED/EXPIRED, which are terminal states.
const ACTIVE_QUOTATION_STATUSES: QuotationStatus[] = ["DRAFT", "SENT", "APPROVED"]

export async function getCustomerCount(companyId: string): Promise<number> {
  return prisma.customer.count({ where: { companyId, isActive: true } })
}

export async function getActiveQuotationCount(companyId: string): Promise<number> {
  return prisma.quotation.count({ where: { companyId, status: { in: ACTIVE_QUOTATION_STATUSES } } })
}

export async function getInvoiceCount(companyId: string): Promise<number> {
  return prisma.invoice.count({ where: { companyId } })
}

/** Sums InventoryStock.quantity per Stock bucket (Equipment/Consumption/Parts) — a total-units count, not a record count. */
export async function getStockQuantityTotals(companyId: string): Promise<Record<StockType, number>> {
  const rows = await prisma.inventoryStock.findMany({
    where: { part: { companyId, isActive: true } },
    select: { quantity: true, part: { select: { category: true } } },
  })
  const totals: Record<StockType, number> = { EQUIPMENT: 0, CONSUMPTION: 0, PARTS: 0 }
  for (const row of rows) {
    totals[getStockType(row.part.category)] += row.quantity
  }
  return totals
}

export type RecentQuotation = {
  id: string
  quotationNumber: string
  status: QuotationStatus
  totalCost: number
  createdAt: Date
  customer: { companyName: string }
}

export async function getRecentQuotations(companyId: string, limit = 5): Promise<RecentQuotation[]> {
  const rows = await prisma.quotation.findMany({
    where: { companyId },
    select: {
      id: true,
      quotationNumber: true,
      status: true,
      totalCost: true,
      createdAt: true,
      customer: { select: { companyName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map((r) => ({ ...r, totalCost: Number(r.totalCost) }))
}

export type RecentInvoice = {
  id: string
  invoiceNumber: string
  totalAmount: number
  date: Date
  customer: { companyName: string }
}

export async function getRecentInvoices(companyId: string, limit = 5): Promise<RecentInvoice[]> {
  const rows = await prisma.invoice.findMany({
    where: { companyId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      date: true,
      customer: { select: { companyName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map((r) => ({ ...r, totalAmount: Number(r.totalAmount) }))
}

export type RecentTask = {
  id: string
  title: string
  status: "ACTIVE" | "COMPLETED"
  createdAt: Date
}

function taskScopeWhere(companyId: string, userId: string, role: Role) {
  if (role === "ADMIN") return { companyId }
  if (role === "MANAGER") {
    return { companyId, OR: [{ createdById: userId }, { participants: { some: { userId } } }] }
  }
  return { companyId, participants: { some: { userId } } }
}

export async function getRecentTasks(companyId: string, userId: string, role: Role, limit = 5): Promise<RecentTask[]> {
  const rows = await prisma.task.findMany({
    where: taskScopeWhere(companyId, userId, role),
    select: { id: true, title: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows
}
