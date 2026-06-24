import { prisma } from "@/lib/prisma"
import { getStockType, getLowStockThreshold, type StockType, type LowStockAlert } from "@/lib/stock-types"
import type {
  SparePart,
  InventoryStock,
  InventoryTransactionWithRelations,
  PartCategory,
  TransactionType,
  JobPart,
  ServiceJob,
} from "@/types"

export type StockLevel = "in_stock" | "low" | "out"

export function getStockLevel(quantity: number, threshold: number): StockLevel {
  if (quantity <= 0) return "out"
  if (quantity <= threshold) return "low"
  return "in_stock"
}

export type SparePartListItem = SparePart & { stock: InventoryStock | null }

export async function getSpareParts(
  companyId: string,
  opts?: { search?: string; category?: PartCategory; categories?: PartCategory[]; stockLevel?: StockLevel }
): Promise<SparePartListItem[]> {
  const { search, category, categories, stockLevel } = opts ?? {}

  const parts = await prisma.sparePart.findMany({
    where: {
      companyId,
      isActive: true,
      ...(categories ? { category: { in: categories } } : category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { partNumber: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { compatibleWith: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { stock: true },
    orderBy: { name: "asc" },
  })

  if (!stockLevel) return parts

  return parts.filter((p) => {
    const qty = p.stock?.quantity ?? 0
    return getStockLevel(qty, getLowStockThreshold(p.category)) === stockLevel
  })
}

export type SparePartDetail = SparePart & {
  stock: InventoryStock | null
  transactions: InventoryTransactionWithRelations[]
  jobParts: (JobPart & { report: { job: Pick<ServiceJob, "id" | "jobNumber"> } })[]
}

export async function getSparePart(
  id: string,
  companyId: string
): Promise<SparePartDetail | null> {
  return prisma.sparePart.findFirst({
    where: { id, companyId },
    include: {
      stock: true,
      transactions: {
        include: {
          part: { select: { id: true, partNumber: true, name: true, unit: true } },
          performedBy: { select: { id: true, name: true } },
          job: { select: { id: true, jobNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      jobParts: {
        include: {
          report: { select: { job: { select: { id: true, jobNumber: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  }) as Promise<SparePartDetail | null>
}

export async function getSparePartForEdit(
  id: string,
  companyId: string
): Promise<(SparePart & { stock: InventoryStock | null }) | null> {
  return prisma.sparePart.findFirst({
    where: { id, companyId },
    include: { stock: true },
  })
}

/** Lightweight list for quotation / repair report part pickers */
export type SparePartOption = Pick<
  SparePart,
  "id" | "partNumber" | "name" | "category" | "unit" | "sellingPrice"
> & {
  stock: Pick<InventoryStock, "quantity"> | null
}

export async function getSparePartOptions(companyId: string): Promise<SparePartOption[]> {
  return prisma.sparePart.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      partNumber: true,
      name: true,
      category: true,
      unit: true,
      sellingPrice: true,
      stock: { select: { quantity: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function getLowStockParts(companyId: string): Promise<SparePartListItem[]> {
  const parts = await prisma.sparePart.findMany({
    where: { companyId, isActive: true },
    include: { stock: true },
    orderBy: { name: "asc" },
  })
  return parts.filter((p) => getStockLevel(p.stock?.quantity ?? 0, getLowStockThreshold(p.category)) !== "in_stock")
}

export async function getLowStockCount(companyId: string): Promise<number> {
  const parts = await getLowStockParts(companyId)
  return parts.length
}

export async function getLowStockAlerts(companyId: string): Promise<LowStockAlert[]> {
  const parts = await prisma.sparePart.findMany({
    where: { companyId, isActive: true },
    include: { stock: true },
    orderBy: { name: "asc" },
  })

  return parts
    .filter((p) => (p.stock?.quantity ?? 0) <= getLowStockThreshold(p.category))
    .map((p) => {
      const quantity = p.stock?.quantity ?? 0
      return {
        id: p.id,
        stockType: getStockType(p.category),
        brand: p.brand,
        name: p.name,
        quantity,
        threshold: getLowStockThreshold(p.category),
        isOutOfStock: quantity === 0,
      }
    })
}

/** Item counts for the 3 Stock cards (Equipment / Consumption / Parts). */
export async function getStockTypeCounts(companyId: string): Promise<Record<StockType, number>> {
  const grouped = await prisma.sparePart.groupBy({
    by: ["category"],
    where: { companyId, isActive: true },
    _count: { _all: true },
  })

  const counts: Record<StockType, number> = { EQUIPMENT: 0, CONSUMPTION: 0, PARTS: 0 }
  for (const row of grouped) {
    counts[getStockType(row.category)] += row._count._all
  }
  return counts
}

// ─── Reports ────────────────────────────────────────────────────────────────

export type InventoryValuationRow = {
  id: string
  partNumber: string
  name: string
  category: PartCategory
  quantity: number
  unitCost: number
  sellingPrice: number
  costValue: number
  sellingValue: number
}

export async function getInventoryValuation(companyId: string): Promise<{
  rows: InventoryValuationRow[]
  totalCostValue: number
  totalSellingValue: number
}> {
  const parts = await prisma.sparePart.findMany({
    where: { companyId, isActive: true },
    include: { stock: true },
    orderBy: { name: "asc" },
  })

  const rows: InventoryValuationRow[] = parts.map((p) => {
    const quantity = p.stock?.quantity ?? 0
    const unitCost = Number(p.unitCost)
    const sellingPrice = Number(p.sellingPrice)
    return {
      id: p.id,
      partNumber: p.partNumber,
      name: p.name,
      category: p.category,
      quantity,
      unitCost,
      sellingPrice,
      costValue: quantity * unitCost,
      sellingValue: quantity * sellingPrice,
    }
  })

  return {
    rows,
    totalCostValue: rows.reduce((sum, r) => sum + r.costValue, 0),
    totalSellingValue: rows.reduce((sum, r) => sum + r.sellingValue, 0),
  }
}

export async function getStockMovements(
  companyId: string,
  opts?: { partId?: string; type?: TransactionType; from?: string; to?: string }
): Promise<InventoryTransactionWithRelations[]> {
  const { partId, type, from, to } = opts ?? {}
  return prisma.inventoryTransaction.findMany({
    where: {
      companyId,
      ...(partId ? { partId } : {}),
      ...(type ? { type } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    include: {
      part: { select: { id: true, partNumber: true, name: true, unit: true } },
      performedBy: { select: { id: true, name: true } },
      job: { select: { id: true, jobNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  }) as Promise<InventoryTransactionWithRelations[]>
}
