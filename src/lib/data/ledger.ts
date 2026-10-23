import { prisma } from "@/lib/prisma"
import { extractTrailingNumber } from "@/lib/numbering"
import { resolveSalesLedgerInvoiceNo } from "@/lib/ledger-utils"
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, LEDGER_ENTRY_TYPE_LABELS, LEDGER_PAYMENT_METHOD_LABELS } from "@/types"
import type { Prisma } from "@/generated/prisma/client"
import type {
  LedgerCategory,
  LedgerEntryWithRelations,
  LedgerEntryType,
  LedgerPaymentMethod,
  SalesLedgerEntry,
  SalesPaymentStatus,
} from "@/types"

// ─── Categories ─────────────────────────────────────────────────────────────────

/**
 * Ensures default categories exist for a company (seeded independently per type), then returns
 * all active categories (optionally filtered by type).
 *
 * Steady-state cost is a single query: the "has this company ever had a category of this type"
 * check (which must ignore isActive, so a company whose categories were all deactivated doesn't
 * get re-seeded) is derived from the same findMany used to build the returned list, instead of
 * two separate COUNT queries run on every call. The only extra round trips (createMany + a
 * refetch) happen once per company, the first time it ever needs a given type's defaults.
 */
export async function getLedgerCategories(
  companyId: string,
  type?: LedgerEntryType
): Promise<LedgerCategory[]> {
  const all = await prisma.ledgerCategory.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  })

  const hasIncome = all.some((c) => c.type === "INCOME")
  const hasExpense = all.some((c) => c.type === "EXPENSE")

  const seedData = [
    ...(!hasIncome ? DEFAULT_INCOME_CATEGORIES.map((name) => ({ companyId, type: "INCOME" as const, name })) : []),
    ...(!hasExpense ? DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ companyId, type: "EXPENSE" as const, name })) : []),
  ]

  if (seedData.length === 0) {
    return all.filter((c) => c.isActive && (!type || c.type === type))
  }

  await prisma.ledgerCategory.createMany({ data: seedData, skipDuplicates: true })
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

export interface LedgerEntryPage {
  entries: LedgerEntryWithRelations[]
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

/** Every enum key (not label) whose own text contains `term` — e.g. term "cas" matches "CASH". Enum lists are fixed and tiny, so this never touches a data row. */
function matchingEnumKeys<T extends string>(labels: Record<T, string>, term: string): T[] {
  return (Object.keys(labels) as T[]).filter((key) => key.toLowerCase().includes(term))
}

/**
 * Builds the shared Prisma `where` for both the paginated list and the unpaginated Excel
 * export — every filter (including `search`) is pushed down to the database, never applied by
 * re-reading all rows into memory. `search` matches the same fields the old in-memory filter
 * did (category name, remark, creator name, payment method, type), just expressed as DB-level
 * conditions: a plain `contains` for the real string columns, and an `in` over whichever enum
 * keys contain the term for the two enum columns (payment method, type).
 */
function buildLedgerEntryWhere(companyId: string, filters: LedgerEntryFilters): Prisma.LedgerEntryWhereInput {
  const { from, to, type, categoryId, paymentMethod, search } = filters
  const dateRange = dateRangeWhere(from, to)
  const term = search?.trim().toLowerCase()

  const where: Prisma.LedgerEntryWhereInput = {
    companyId,
    ...(type ? { type } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(dateRange ? { date: dateRange } : {}),
  }

  if (term) {
    const matchingTypes = matchingEnumKeys(LEDGER_ENTRY_TYPE_LABELS, term)
    const matchingPaymentMethods = matchingEnumKeys(LEDGER_PAYMENT_METHOD_LABELS, term)
    where.OR = [
      { category: { name: { contains: term, mode: "insensitive" } } },
      { remark: { contains: term, mode: "insensitive" } },
      { createdBy: { name: { contains: term, mode: "insensitive" } } },
      ...(matchingPaymentMethods.length > 0 ? [{ paymentMethod: { in: matchingPaymentMethods } }] : []),
      ...(matchingTypes.length > 0 ? [{ type: { in: matchingTypes } }] : []),
    ]
  }

  return where
}

const LEDGER_ENTRY_INCLUDE = {
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
} satisfies Prisma.LedgerEntryInclude

// Secondary `id` key makes the sort stable across equal `date` values, so paging forward never
// re-shows or skips a row just because several entries share the same date.
const LEDGER_ENTRY_ORDER_BY: Prisma.LedgerEntryOrderByWithRelationInput[] = [{ date: "desc" }, { id: "desc" }]

/** All matching entries, unpaginated — used only by the Excel export, which must always cover every filtered record regardless of the list page's current page. */
export async function getLedgerEntries(companyId: string, filters?: LedgerEntryFilters): Promise<LedgerEntryWithRelations[]>
/** One page of matching entries plus the total count — used by the Income & Expense Book list. */
export async function getLedgerEntries(
  companyId: string,
  filters: LedgerEntryFilters,
  pagination: { page: number; pageSize: number }
): Promise<LedgerEntryPage>
export async function getLedgerEntries(
  companyId: string,
  filters: LedgerEntryFilters = {},
  pagination?: { page: number; pageSize: number }
): Promise<LedgerEntryWithRelations[] | LedgerEntryPage> {
  const where = buildLedgerEntryWhere(companyId, filters)

  if (!pagination) {
    const rows = await prisma.ledgerEntry.findMany({
      where,
      include: LEDGER_ENTRY_INCLUDE,
      orderBy: LEDGER_ENTRY_ORDER_BY,
    })
    return rows.map((e) => ({
      ...e,
      amount: Number(e.amount),
      allocations: e.allocations.map((a) => ({
        salesLedgerEntryId: a.salesLedgerEntryId,
        amount: Number(a.allocatedAmount),
        orderNo: a.salesLedgerEntry.orderNo,
      })),
    }))
  }

  const page = pagination.page > 0 ? Math.floor(pagination.page) : 1
  const pageSize = pagination.pageSize > 0 ? Math.floor(pagination.pageSize) : 50

  const [rows, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: LEDGER_ENTRY_INCLUDE,
      orderBy: LEDGER_ENTRY_ORDER_BY,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ledgerEntry.count({ where }),
  ])

  return {
    entries: rows.map((e) => ({
      ...e,
      amount: Number(e.amount),
      allocations: e.allocations.map((a) => ({
        salesLedgerEntryId: a.salesLedgerEntryId,
        amount: Number(a.allocatedAmount),
        orderNo: a.salesLedgerEntry.orderNo,
      })),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/**
 * Current calendar month's income/expense totals — summed in the database (one `groupBy`,
 * using the companyId+date index) instead of pulling every matching row into Node and reducing
 * there. Same two numbers, same rounding (Postgres `numeric` SUM is exact; the final `Number()`
 * conversion happens at the same point as before), just computed where the data already lives.
 */
export async function getLedgerMonthStats(companyId: string): Promise<{ income: number; expense: number }> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const sums = await prisma.ledgerEntry.groupBy({
    by: ["type"],
    where: { companyId, date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
  })

  const income = sums.find((s) => s.type === "INCOME")?._sum.amount
  const expense = sums.find((s) => s.type === "EXPENSE")?._sum.amount
  return { income: Number(income ?? 0), expense: Number(expense ?? 0) }
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
      // Invoice No search must reach both manual entries (own orderNo field) and
      // invoice-generated entries — via the live Invoice.invoiceNumber relation, not the
      // orderNo snapshot copied at generation time, which can go stale after a rename.
      ...(customerName
        ? {
            OR: [
              { customerName: { contains: customerName, mode: "insensitive" } },
              { orderNo: { contains: customerName, mode: "insensitive" } },
              { invoice: { invoiceNumber: { contains: customerName, mode: "insensitive" } } },
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
    // No DB-side `orderBy` for Invoice No. here — Prisma's ORM can't express
    // "COALESCE(invoice.invoiceSortNumber, referenceSequence)" across a
    // relation, and a multi-key `orderBy: [{ invoice: {...} }, { referenceSequence: {...} }, ...]`
    // is NOT a coalesce: Prisma orderBy is strictly lexicographic, so the
    // first key alone (non-null only for invoice-linked rows) fully
    // partitions the result into "all invoice-generated rows" then "all
    // manual rows" as two separate blocks — a source-based grouping bug,
    // not a numeric sort. Fixed below with a single unified in-memory sort
    // instead (small result set — no pagination on this list).
  })

  const sorted = entries.sort((a, b) => {
    // Same "effective Invoice No." shown on screen for every row (see
    // resolveSalesLedgerInvoiceNo — the live linked Invoice's number when
    // present, else the manual `orderNo` field), compared with the exact
    // same trailing-digit-sequence rule Invoice's own list already sorts
    // by (extractTrailingNumber) — so invoice-generated and manual rows are
    // never grouped by source, only by this one numeric value.
    const aSeq = extractTrailingNumber(resolveSalesLedgerInvoiceNo(a) ?? "")
    const bSeq = extractTrailingNumber(resolveSalesLedgerInvoiceNo(b) ?? "")
    if (aSeq !== null && bSeq !== null && aSeq !== bSeq) return bSeq - aSeq
    if (aSeq !== null && bSeq === null) return -1
    if (aSeq === null && bSeq !== null) return 1
    // Deterministic fallback for ties and non-standard/unparseable Invoice
    // Nos (never left to whatever order Postgres happened to return).
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
    if (dateDiff !== 0) return dateDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return sorted.map((e) => ({
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
