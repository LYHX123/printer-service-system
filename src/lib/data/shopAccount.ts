import { prisma } from "@/lib/prisma"
import { DEFAULT_SHOP_EXPENSE_CATEGORIES, DEFAULT_SHOP_INCOME_CATEGORIES } from "@/types"
import type {
  ShopAccountCategory,
  ShopAccountEntry,
  LedgerEntryType,
  LedgerPaymentMethod,
} from "@/types"

// ─── Categories ─────────────────────────────────────────────────────────────────

/** Ensures the 10 default categories exist for a company, then returns all active ones. */
export async function getShopAccountCategories(
  companyId: string,
  type?: LedgerEntryType
): Promise<ShopAccountCategory[]> {
  const [incomeCount, expenseCount] = await Promise.all([
    prisma.shopAccountCategory.count({ where: { companyId, type: "INCOME" } }),
    prisma.shopAccountCategory.count({ where: { companyId, type: "EXPENSE" } }),
  ])

  const seedData = [
    ...(incomeCount === 0 ? DEFAULT_SHOP_INCOME_CATEGORIES.map((name) => ({ companyId, type: "INCOME" as const, name })) : []),
    ...(expenseCount === 0 ? DEFAULT_SHOP_EXPENSE_CATEGORIES.map((name) => ({ companyId, type: "EXPENSE" as const, name })) : []),
  ]
  if (seedData.length > 0) {
    await prisma.shopAccountCategory.createMany({ data: seedData, skipDuplicates: true })
  }

  return prisma.shopAccountCategory.findMany({
    where: { companyId, isActive: true, ...(type ? { type } : {}) },
    orderBy: { name: "asc" },
  })
}

export async function findOrCreateShopAccountCategory(
  companyId: string,
  type: LedgerEntryType,
  name: string
): Promise<ShopAccountCategory> {
  const trimmed = name.trim()
  const existing = await prisma.shopAccountCategory.findFirst({
    where: { companyId, type, name: { equals: trimmed, mode: "insensitive" } },
  })
  if (existing) return existing

  return prisma.shopAccountCategory.create({ data: { companyId, type, name: trimmed } })
}

// ─── Entries ────────────────────────────────────────────────────────────────────

export interface ShopAccountFilters {
  from?: string
  to?: string
  type?: LedgerEntryType
  categoryId?: string
  paymentMethod?: LedgerPaymentMethod
  createdById?: string
  search?: string
}

function dateRangeWhere(from?: string, to?: string) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  }
}

export type ShopAccountEntryWithRelations = Omit<ShopAccountEntry, "amount"> & {
  amount: number
  category: Pick<ShopAccountCategory, "id" | "name" | "type">
  createdBy: { id: string; name: string }
}

function whereFromFilters(companyId: string, filters: ShopAccountFilters) {
  const { from, to, type, categoryId, paymentMethod, createdById } = filters
  const dateRange = dateRangeWhere(from, to)
  return {
    companyId,
    ...(type ? { type } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(createdById ? { createdById } : {}),
    ...(dateRange ? { date: dateRange } : {}),
  }
}

export async function getShopAccountEntries(
  companyId: string,
  filters: ShopAccountFilters = {}
): Promise<ShopAccountEntryWithRelations[]> {
  const rows = await prisma.shopAccountEntry.findMany({
    where: whereFromFilters(companyId, filters),
    include: {
      category: { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  })

  const entries: ShopAccountEntryWithRelations[] = rows.map((e) => ({ ...e, amount: Number(e.amount) }))

  const { search } = filters
  if (!search?.trim()) return entries

  const term = search.trim().toLowerCase()
  return entries.filter(
    (e) =>
      e.category.name.toLowerCase().includes(term) ||
      e.description.toLowerCase().includes(term) ||
      (e.payee ?? "").toLowerCase().includes(term) ||
      (e.remarks ?? "").toLowerCase().includes(term) ||
      e.createdBy.name.toLowerCase().includes(term)
  )
}

/** Totals for the SAME filter set as the list — so the stat cards react live to filtering. */
export async function getShopAccountTotals(
  companyId: string,
  filters: ShopAccountFilters = {}
): Promise<{ totalIncome: number; totalExpense: number; balance: number }> {
  // Search is applied in-memory (see getShopAccountEntries), so route totals
  // through the same function rather than re-querying to keep them consistent.
  const entries = await getShopAccountEntries(companyId, filters)
  let totalIncome = 0
  let totalExpense = 0
  for (const e of entries) {
    if (e.type === "INCOME") totalIncome += e.amount
    else totalExpense += e.amount
  }
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense }
}

export async function getShopAccountEntry(
  id: string,
  companyId: string
): Promise<ShopAccountEntryWithRelations | null> {
  const row = await prisma.shopAccountEntry.findFirst({
    where: { id, companyId },
    include: {
      category: { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!row) return null
  return { ...row, amount: Number(row.amount) }
}

/** Current month's total Shop Account expense — used by the Dashboard. */
export async function getCurrentMonthShopExpense(companyId: string): Promise<number> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const result = await prisma.shopAccountEntry.aggregate({
    where: { companyId, type: "EXPENSE", date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
  })
  return Number(result._sum.amount ?? 0)
}

export async function getRecentShopAccountEntries(companyId: string, limit = 5): Promise<ShopAccountEntryWithRelations[]> {
  const rows = await prisma.shopAccountEntry.findMany({
    where: { companyId },
    include: {
      category: { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  })
  return rows.map((e) => ({ ...e, amount: Number(e.amount) }))
}

/** For the "Created By" filter dropdown — everyone who has logged at least one entry. */
export async function getShopAccountContributors(companyId: string): Promise<{ id: string; name: string }[]> {
  const rows = await prisma.shopAccountEntry.findMany({
    where: { companyId },
    select: { createdBy: { select: { id: true, name: true } } },
    distinct: ["createdById"],
  })
  return rows.map((r) => r.createdBy).sort((a, b) => a.name.localeCompare(b.name))
}
