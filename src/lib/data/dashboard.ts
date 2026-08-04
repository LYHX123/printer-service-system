import { prisma } from "@/lib/prisma"
import { getStockType, type StockType } from "@/lib/stock-types"
import type { Role, QuotationStatus } from "@/types"

// Quotations still "live" — could still become an invoice. Excludes
// REJECTED/CONVERTED/EXPIRED, which are terminal states.
const ACTIVE_QUOTATION_STATUSES: QuotationStatus[] = ["DRAFT", "SENT", "APPROVED"]

/**
 * "This month" boundaries — mirrors the exact same computation already used
 * (independently, inline) by getLedgerMonthStats (src/lib/data/ledger.ts)
 * and getCurrentMonthShopExpense (src/lib/data/shopAccount.ts): calendar
 * month in the server process's local time. Deliberately not swapped for a
 * timezone-aware library here — the goal is bit-for-bit consistency with
 * those two already-shipped Financial Overview numbers, not a "more
 * correct" but diverging definition of "this month" introduced only for
 * the new metrics. Kept local to this file (not extracted into ledger.ts/
 * shopAccount.ts) since this round must not touch Ledger/Shop Account
 * business logic.
 */
function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

export async function getCustomerCount(companyId: string): Promise<number> {
  return prisma.customer.count({ where: { companyId, isActive: true } })
}

export interface CustomerDashboardMetrics {
  total: number
  newThisMonth: number
}

export async function getCustomerDashboardMetrics(companyId: string): Promise<CustomerDashboardMetrics> {
  const { start, end } = getCurrentMonthRange()
  const [total, newThisMonth] = await Promise.all([
    prisma.customer.count({ where: { companyId, isActive: true } }),
    prisma.customer.count({ where: { companyId, createdAt: { gte: start, lte: end } } }),
  ])
  return { total, newThisMonth }
}

/**
 * Quotation has no dedicated business-entry date field (checked
 * prisma/schema.prisma directly — only createdAt (auto) and validUntil
 * (expiry, not a creation/business date) exist), so "this month" uses
 * createdAt, matching how getRecentQuotations below already orders by it.
 */
export interface QuotationDashboardMetrics {
  countThisMonth: number
  approvedThisMonth: number
}

export async function getQuotationDashboardMetrics(companyId: string): Promise<QuotationDashboardMetrics> {
  const { start, end } = getCurrentMonthRange()
  const [countThisMonth, approvedThisMonth] = await Promise.all([
    prisma.quotation.count({ where: { companyId, createdAt: { gte: start, lte: end } } }),
    // Approved-this-month = approved *during* this month (approvedAt, set
    // exactly once at Approve time — see approveQuotation in
    // src/lib/actions/quotations.ts), not "created this month and
    // currently APPROVED" — the latter would miss quotations approved this
    // month but created in an earlier one.
    prisma.quotation.count({ where: { companyId, status: "APPROVED", approvedAt: { gte: start, lte: end } } }),
  ])
  return { countThisMonth, approvedThisMonth }
}

/**
 * Invoice.date is a real, separate business date field (unlike Quotation) —
 * already the field Invoice Dropbox month-routing and getRecentInvoices'
 * display both key off. "This month" uses it, not createdAt. Status is
 * intentionally not filtered (matches the existing getInvoiceCount, which
 * also counts every status) — no new Paid/Unpaid/status judgment call is
 * introduced here.
 */
export interface InvoiceDashboardMetrics {
  countThisMonth: number
  valueThisMonth: number
}

export async function getInvoiceDashboardMetrics(companyId: string): Promise<InvoiceDashboardMetrics> {
  const { start, end } = getCurrentMonthRange()
  const agg = await prisma.invoice.aggregate({
    where: { companyId, date: { gte: start, lte: end } },
    _count: true,
    _sum: { totalAmount: true },
  })
  return { countThisMonth: agg._count, valueThisMonth: Number(agg._sum.totalAmount ?? 0) }
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

export type RecentLedgerEntry = {
  id: string
  type: "INCOME" | "EXPENSE"
  amount: number
  date: Date
  remark: string | null
  category: { name: string }
}

/** Lean, dashboard-only select (no full LedgerEntryWithRelations include) — deliberately not reusing the heavier general-purpose Ledger list query. */
export async function getRecentLedgerEntries(companyId: string, limit = 4): Promise<RecentLedgerEntry[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { companyId },
    select: { id: true, type: true, amount: true, date: true, remark: true, category: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: limit,
  })
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
}

export type RecentStockMovement = {
  id: string
  type: string
  quantity: number
  createdAt: Date
  part: { name: string }
}

/** Lean, dashboard-only select — deliberately not reusing the heavier getStockMovements (full relations, take 200) from src/lib/data/inventory.ts. */
export async function getRecentStockMovements(companyId: string, limit = 4): Promise<RecentStockMovement[]> {
  const rows = await prisma.inventoryTransaction.findMany({
    where: { companyId },
    select: { id: true, type: true, quantity: true, createdAt: true, part: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows
}

// ─── Unified Recent Activity feed ──────────────────────────────────────────────
// dashboard/page.tsx fetches each module's small recent list independently,
// behind the exact same permission ternaries as every other Dashboard query
// (never queried for a module the user can't see) — these normalizers just
// reshape an already-fetched, already-permission-gated array into one common
// shape so they can be merged, sorted, and capped together. No DB access here.

export type DashboardActivityKind = "quotation" | "invoice" | "task" | "ledger" | "shopAccount" | "stock"

export interface DashboardActivityItem {
  kind: DashboardActivityKind
  id: string
  timestamp: Date
  title: string
  subtitle: string
  amount: number | null
  amountSign: "+" | "-" | null
  /** false for a plain unit count (Stock's quantity) — true (money) everywhere else that sets `amount`. */
  amountIsCurrency: boolean
  href: string
}

export function quotationsToActivity(rows: RecentQuotation[]): DashboardActivityItem[] {
  return rows.map((q) => ({
    kind: "quotation",
    id: q.id,
    timestamp: q.createdAt,
    title: q.quotationNumber,
    subtitle: q.customer.companyName,
    amount: q.totalCost,
    amountSign: null,
    amountIsCurrency: true,
    href: `/quotations/${q.id}`,
  }))
}

export function invoicesToActivity(rows: RecentInvoice[]): DashboardActivityItem[] {
  return rows.map((inv) => ({
    kind: "invoice",
    id: inv.id,
    timestamp: inv.date,
    title: inv.invoiceNumber,
    subtitle: inv.customer.companyName,
    amount: inv.totalAmount,
    amountSign: null,
    amountIsCurrency: true,
    href: `/quotations/invoices/${inv.id}`,
  }))
}

export function tasksToActivity(rows: RecentTask[]): DashboardActivityItem[] {
  return rows.map((task) => ({
    kind: "task",
    id: task.id,
    timestamp: task.createdAt,
    title: task.title,
    subtitle: task.status,
    amount: null,
    amountSign: null,
    amountIsCurrency: false,
    href: `/tasks?taskId=${task.id}`,
  }))
}

export function ledgerToActivity(rows: RecentLedgerEntry[]): DashboardActivityItem[] {
  return rows.map((entry) => ({
    kind: "ledger",
    id: entry.id,
    timestamp: entry.date,
    title: entry.remark?.trim() || entry.category.name,
    subtitle: entry.category.name,
    amount: entry.amount,
    amountSign: entry.type === "INCOME" ? "+" : "-",
    amountIsCurrency: true,
    href: "/ledger/income-expense",
  }))
}

export function shopAccountToActivity(rows: { id: string; description: string; date: Date; amount: number; type: "INCOME" | "EXPENSE"; category: { name: string } }[]): DashboardActivityItem[] {
  return rows.map((entry) => ({
    kind: "shopAccount",
    id: entry.id,
    timestamp: entry.date,
    title: entry.description,
    subtitle: entry.category.name,
    amount: entry.amount,
    amountSign: entry.type === "INCOME" ? "+" : "-",
    amountIsCurrency: true,
    href: "/ledger/shop",
  }))
}

export function stockToActivity(rows: RecentStockMovement[]): DashboardActivityItem[] {
  return rows.map((m) => ({
    kind: "stock",
    id: m.id,
    timestamp: m.createdAt,
    title: m.part.name,
    subtitle: m.type,
    amount: m.quantity,
    amountSign: null,
    amountIsCurrency: false,
    href: "/stock/movements",
  }))
}

/** Merges already-permission-gated activity arrays, newest first, capped. Pure function — no DB access. */
export function mergeRecentActivity(sources: DashboardActivityItem[][], limit = 8): DashboardActivityItem[] {
  return sources
    .flat()
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}
