import { prisma } from "@/lib/prisma"
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/types"
import type {
  LedgerCategory,
  LedgerEntryWithRelations,
  LedgerEntryType,
  LedgerPaymentMethod,
  SalesLedgerEntry,
  SalesPaymentStatus,
} from "@/types"

// ─── Categories ─────────────────────────────────────────────────────────────────

/** Ensures default categories exist for a company, then returns all active categories (optionally filtered by type). */
export async function getLedgerCategories(
  companyId: string,
  type?: LedgerEntryType
): Promise<LedgerCategory[]> {
  const existingCount = await prisma.ledgerCategory.count({ where: { companyId } })
  if (existingCount === 0) {
    await prisma.ledgerCategory.createMany({
      data: [
        ...DEFAULT_INCOME_CATEGORIES.map((name) => ({ companyId, type: "INCOME" as const, name })),
        ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ companyId, type: "EXPENSE" as const, name })),
      ],
      skipDuplicates: true,
    })
  }

  return prisma.ledgerCategory.findMany({
    where: { companyId, isActive: true, ...(type ? { type } : {}) },
    orderBy: { name: "asc" },
  })
}

/** Finds an existing active category by name (case-insensitive) or creates a new one. */
export async function findOrCreateLedgerCategory(
  companyId: string,
  type: LedgerEntryType,
  name: string
): Promise<LedgerCategory> {
  const trimmed = name.trim()
  const existing = await prisma.ledgerCategory.findFirst({
    where: { companyId, type, name: { equals: trimmed, mode: "insensitive" } },
  })
  if (existing) return existing

  return prisma.ledgerCategory.create({ data: { companyId, type, name: trimmed } })
}

// ─── Income & Expense Book ──────────────────────────────────────────────────────

export interface LedgerEntryFilters {
  from?: string
  to?: string
  type?: LedgerEntryType
  categoryId?: string
  paymentMethod?: LedgerPaymentMethod
  archived?: boolean
}

function dateRangeWhere(from?: string, to?: string) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  }
}

export async function getLedgerEntries(
  companyId: string,
  filters: LedgerEntryFilters = {}
): Promise<LedgerEntryWithRelations[]> {
  const { from, to, type, categoryId, paymentMethod, archived = false } = filters
  const dateRange = dateRangeWhere(from, to)

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      isArchived: archived,
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(dateRange ? { date: dateRange } : {}),
    },
    include: {
      category: { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  })

  return entries.map((e) => ({ ...e, amount: Number(e.amount) }))
}

// ─── Sales Ledger ────────────────────────────────────────────────────────────────

export interface SalesLedgerFilters {
  from?: string
  to?: string
  customerName?: string
  paymentStatus?: SalesPaymentStatus
  archived?: boolean
}

export type SalesLedgerListItem = Omit<SalesLedgerEntry, "invoiceAmount" | "amountReceived" | "balance"> & {
  invoiceAmount: number
  amountReceived: number
  balance: number
}

export async function getSalesLedgerEntries(
  companyId: string,
  filters: SalesLedgerFilters = {}
): Promise<SalesLedgerListItem[]> {
  const { from, to, customerName, paymentStatus, archived = false } = filters
  const dateRange = dateRangeWhere(from, to)

  const entries = await prisma.salesLedgerEntry.findMany({
    where: {
      companyId,
      isArchived: archived,
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(customerName ? { customerName: { contains: customerName, mode: "insensitive" } } : {}),
      ...(dateRange ? { date: dateRange } : {}),
    },
    orderBy: { date: "desc" },
  })

  return entries.map((e) => ({
    ...e,
    invoiceAmount: Number(e.invoiceAmount),
    amountReceived: Number(e.amountReceived),
    balance: Number(e.balance),
  }))
}
