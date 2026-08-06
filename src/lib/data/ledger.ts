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

/** Ensures default categories exist for a company (seeded independently per type), then returns all active categories (optionally filtered by type). */
export async function getLedgerCategories(
  companyId: string,
  type?: LedgerEntryType
): Promise<LedgerCategory[]> {
  const [incomeCount, expenseCount] = await Promise.all([
    prisma.ledgerCategory.count({ where: { companyId, type: "INCOME" } }),
    prisma.ledgerCategory.count({ where: { companyId, type: "EXPENSE" } }),
  ])

  const seedData = [
    ...(incomeCount === 0 ? DEFAULT_INCOME_CATEGORIES.map((name) => ({ companyId, type: "INCOME" as const, name })) : []),
    ...(expenseCount === 0 ? DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ companyId, type: "EXPENSE" as const, name })) : []),
  ]
  if (seedData.length > 0) {
    await prisma.ledgerCategory.createMany({ data: seedData, skipDuplicates: true })
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
  search?: string
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
  const { from, to, type, categoryId, paymentMethod, search } = filters
  const dateRange = dateRangeWhere(from, to)

  const rows = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(dateRange ? { date: dateRange } : {}),
    },
    include: {
      category: { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
      customer: { select: { id: true, companyName: true } },
      allocations: {
        select: {
          salesLedgerEntryId: true,
          allocatedAmount: true,
          salesLedgerEntry: { select: { orderNo: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  })

  const entries: LedgerEntryWithRelations[] = rows.map((e) => ({
    ...e,
    amount: Number(e.amount),
    allocations: e.allocations.map((a) => ({
      salesLedgerEntryId: a.salesLedgerEntryId,
      amount: Number(a.allocatedAmount),
      orderNo: a.salesLedgerEntry.orderNo,
    })),
  }))

  if (!search?.trim()) return entries

  const term = search.trim().toLowerCase()
  return entries.filter(
    (e) =>
      e.category.name.toLowerCase().includes(term) ||
      (e.remark ?? "").toLowerCase().includes(term) ||
      e.createdBy.name.toLowerCase().includes(term) ||
      e.paymentMethod.toLowerCase().includes(term) ||
      e.type.toLowerCase().includes(term)
  )
}

export async function getLedgerMonthStats(companyId: string): Promise<{ income: number; expense: number }> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const rows = await prisma.ledgerEntry.findMany({
    where: { companyId, date: { gte: monthStart, lte: monthEnd } },
    select: { type: true, amount: true },
  })

  let income = 0
  let expense = 0
  for (const r of rows) {
    const a = Number(r.amount)
    if (r.type === "INCOME") income += a
    else expense += a
  }
  return { income, expense }
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
  customerId: string | null
  invoiceId: string | null
  createdBy: { id: string; name: string }
  /** The linked Invoice's own business number — Phase 2 traceability. Loaded via the same query (no per-row follow-up), null for legacy/manual entries with no linked Invoice. */
  invoice: { id: string; invoiceNumber: string } | null
  _count: { allocations: number }
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
      ...(customerName
        ? {
            OR: [
              { customerName: { contains: customerName, mode: "insensitive" } },
              { orderNo: { contains: customerName, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(dateRange ? { date: dateRange } : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      _count: { select: { allocations: true } },
    },
    // Strictly by the linked Invoice's natural business number first (spec: Invoice Number
    // descending, unaffected by edits/payments) — legacy/manual entries with no linked
    // Invoice fall through to the pre-existing referenceYear/referenceSequence scheme so
    // they keep their relative order among themselves instead of all clumping together.
    orderBy: [
      { invoice: { invoiceSortNumber: { sort: "desc", nulls: "last" } } },
      { referenceYear: { sort: "desc", nulls: "last" } },
      { referenceSequence: { sort: "desc", nulls: "last" } },
      { date: "desc" },
      { createdAt: "desc" },
    ],
  })

  return entries.map((e) => ({
    ...e,
    invoiceAmount: Number(e.invoiceAmount),
    amountReceived: Number(e.amountReceived),
    balance: Number(e.balance),
  })) as SalesLedgerListItem[]
}

/** Total outstanding balance across all non-archived, not-fully-paid sales invoices. */
export async function getUnpaidSalesBalance(companyId: string): Promise<number> {
  const result = await prisma.salesLedgerEntry.aggregate({
    where: { companyId, isArchived: false, paymentStatus: { not: "PAID" } },
    _sum: { balance: true },
  })
  return Number(result._sum.balance ?? 0)
}

function monthRange(year: number, monthIndex0: number): { start: Date; end: Date } {
  return {
    start: new Date(year, monthIndex0, 1, 0, 0, 0),
    end: new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999),
  }
}

/**
 * Sum of Sales Ledger sale amounts whose own sale date falls in the current
 * calendar month — a pure "what was sold this month" figure, independent of
 * when (or whether) any of it has been collected.
 */
export async function getCurrentMonthSalesTotal(companyId: string): Promise<number> {
  const now = new Date()
  const { start, end } = monthRange(now.getFullYear(), now.getMonth())
  const result = await prisma.salesLedgerEntry.aggregate({
    where: { companyId, isArchived: false, date: { gte: start, lte: end } },
    _sum: { invoiceAmount: true },
  })
  return Number(result._sum.invoiceAmount ?? 0)
}

/**
 * Sum of receipt money actually applied to Sales Ledger invoices during the
 * current calendar month, grouped by the RECEIPT's own date (LedgerEntry.date)
 * — a cash-flow figure, deliberately independent of which month the sale
 * being paid off originated in. Scoped through both sides of the allocation
 * (the receiving LedgerEntry and the target SalesLedgerEntry) so a receipt or
 * sale from another company can never contribute here even indirectly.
 */
export async function getCurrentMonthSalesIncomeTotal(companyId: string): Promise<number> {
  const now = new Date()
  const { start, end } = monthRange(now.getFullYear(), now.getMonth())
  const result = await prisma.receiptAllocation.aggregate({
    where: {
      ledgerEntry: { companyId, date: { gte: start, lte: end } },
      salesLedgerEntry: { companyId },
    },
    _sum: { allocatedAmount: true },
  })
  return Number(result._sum.allocatedAmount ?? 0)
}

export type MonthlySalesStat = {
  /** 1-12 */
  month: number
  sales: number
  collected: number
  balance: number
}

/**
 * Shared by both call shapes below — grouping is always by each Sales Ledger
 * entry's OWN sale date; "collected"/"balance" reflect every receipt currently
 * allocated to that entry as of right now, regardless of which month or year
 * the receipt itself was recorded in. This is why a July balance can still
 * drop to zero after a September (or next-year) payment: the figure is always
 * recomputed live from current allocations, never a stored month-end
 * snapshot. Exactly two queries total (entries in range, then one grouped
 * allocation sum for all of them) — no per-month or per-entry query.
 */
async function computeMonthlyStats(companyId: string, start: Date, end: Date, bucketCount: number, bucketIndex: (date: Date) => number): Promise<MonthlySalesStat[]> {
  const entries = await prisma.salesLedgerEntry.findMany({
    where: { companyId, isArchived: false, date: { gte: start, lte: end } },
    select: { id: true, date: true, invoiceAmount: true },
  })

  const ids = entries.map((e) => e.id)
  const allocationSums =
    ids.length > 0
      ? await prisma.receiptAllocation.groupBy({
          by: ["salesLedgerEntryId"],
          where: { salesLedgerEntryId: { in: ids } },
          _sum: { allocatedAmount: true },
        })
      : []
  const receivedByEntryId = new Map(allocationSums.map((a) => [a.salesLedgerEntryId, Number(a._sum.allocatedAmount ?? 0)]))

  const buckets: MonthlySalesStat[] = Array.from({ length: bucketCount }, (_, i) => ({ month: i + 1, sales: 0, collected: 0, balance: 0 }))
  for (const e of entries) {
    const bucket = buckets[bucketIndex(e.date)]
    const sales = Number(e.invoiceAmount)
    const collected = receivedByEntryId.get(e.id) ?? 0
    bucket.sales += sales
    bucket.collected += collected
    bucket.balance += sales - collected
  }
  return buckets
}

/** One row per calendar month of `year` — unchanged 12-month shape used by existing callers/tests. */
export async function getSalesLedgerMonthlyStatistics(companyId: string, year: number): Promise<MonthlySalesStat[]>
/** A single specified month (1-12) of `year` — same underlying logic, narrower query, one-element result. */
export async function getSalesLedgerMonthlyStatistics(companyId: string, year: number, month: number): Promise<[MonthlySalesStat]>
export async function getSalesLedgerMonthlyStatistics(companyId: string, year: number, month?: number): Promise<MonthlySalesStat[]> {
  if (month === undefined) {
    const { start } = monthRange(year, 0)
    const { end } = monthRange(year, 11)
    return computeMonthlyStats(companyId, start, end, 12, (date) => date.getMonth())
  }
  const { start, end } = monthRange(year, month - 1)
  const [stat] = await computeMonthlyStats(companyId, start, end, 1, () => 0)
  return [{ ...stat, month }]
}

/** Earliest year with a non-archived Sales Ledger sale, through the current year — feeds the Monthly Sales Statistics year selector. Falls back to just the current year for a company with no Sales Ledger history yet. */
export async function getSalesLedgerYearRange(companyId: string): Promise<{ minYear: number; maxYear: number }> {
  const currentYear = new Date().getFullYear()
  const earliest = await prisma.salesLedgerEntry.aggregate({
    where: { companyId, isArchived: false },
    _min: { date: true },
  })
  const minYear = earliest._min.date ? Math.min(earliest._min.date.getFullYear(), currentYear) : currentYear
  return { minYear, maxYear: currentYear }
}

/** A customer's UNPAID/PARTIAL Sales Ledger entries — feeds the Receipt Allocation panel on the Income form. */
export type AllocatableSalesLedgerEntry = {
  id: string
  orderNo: string | null
  invoiceAmount: number
  amountReceived: number
  balance: number
}

export async function getUnpaidSalesLedgerEntriesForCustomer(
  customerId: string,
  companyId: string
): Promise<AllocatableSalesLedgerEntry[]> {
  const entries = await prisma.salesLedgerEntry.findMany({
    where: {
      companyId,
      customerId,
      isArchived: false,
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
    },
    select: { id: true, orderNo: true, invoiceAmount: true, amountReceived: true, balance: true },
    orderBy: [
      { invoice: { invoiceSortNumber: { sort: "desc", nulls: "last" } } },
      { date: "desc" },
    ],
  })
  return entries.map((e) => ({
    ...e,
    invoiceAmount: Number(e.invoiceAmount),
    amountReceived: Number(e.amountReceived),
    balance: Number(e.balance),
  }))
}

/** Sales Ledger detail — entry + its full Payment History (every ReceiptAllocation, joined to the receiving LedgerEntry). */
export type SalesLedgerDetail = SalesLedgerListItem & {
  invoice: { id: string; invoiceNumber: string } | null
  paymentHistory: {
    id: string
    amount: number
    date: Date
    referenceNo: string | null
    createdBy: { id: string; name: string }
  }[]
}

export async function getSalesLedgerEntry(id: string, companyId: string): Promise<SalesLedgerDetail | null> {
  const entry = await prisma.salesLedgerEntry.findFirst({
    where: { id, companyId },
    include: {
      createdBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      _count: { select: { allocations: true } },
      allocations: {
        include: { ledgerEntry: { select: { id: true, date: true, referenceNo: true, createdBy: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })
  if (!entry) return null

  const { allocations, ...rest } = entry
  return {
    ...rest,
    invoiceAmount: Number(rest.invoiceAmount),
    amountReceived: Number(rest.amountReceived),
    balance: Number(rest.balance),
    paymentHistory: allocations.map((a) => ({
      id: a.id,
      amount: Number(a.allocatedAmount),
      date: a.ledgerEntry.date,
      referenceNo: a.ledgerEntry.referenceNo,
      createdBy: a.ledgerEntry.createdBy,
    })),
  } as SalesLedgerDetail
}
