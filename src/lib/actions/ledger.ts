"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { LedgerEntrySchema, SalesLedgerEntrySchema } from "@/lib/schemas"
import { canCreateLedgerEntryPerm, canEditLedgerEntryPerm, canDeleteLedgerEntryPerm, canAllocateReceipt } from "@/lib/permissions"
import { findOrCreateLedgerCategory } from "@/lib/data/ledger"
import { computeSalesLedgerStatus } from "@/lib/ledger-utils"
import { parseSalesReference } from "@/lib/ledger-reference"
import type { LedgerEntryInput, SalesLedgerEntryInput, ReceiptAllocationInput } from "@/lib/schemas"
import type { Role } from "@/types"

const NEW_CATEGORY_VALUE = "__new__"

// ─── Income & Expense Book ──────────────────────────────────────────────────────

/**
 * Recomputes one SalesLedgerEntry's amountReceived/balance/paymentStatus from
 * SUM(ReceiptAllocation.allocatedAmount) — never incremented by hand. This is the
 * single source of truth used by every create/update/delete path below, so
 * editing or deleting a receipt can never leave stale paid/balance numbers behind.
 */
async function recomputeSalesLedgerEntry(tx: Prisma.TransactionClient, salesLedgerEntryId: string) {
  const entry = await tx.salesLedgerEntry.findUnique({
    where: { id: salesLedgerEntryId },
    select: { invoiceAmount: true },
  })
  if (!entry) return

  const agg = await tx.receiptAllocation.aggregate({
    where: { salesLedgerEntryId },
    _sum: { allocatedAmount: true },
  })
  const amountReceived = Number(agg._sum.allocatedAmount ?? 0)
  const { balance, status } = computeSalesLedgerStatus(Number(entry.invoiceAmount), amountReceived)

  await tx.salesLedgerEntry.update({
    where: { id: salesLedgerEntryId },
    data: { amountReceived, balance, paymentStatus: status },
  })
}

/** Validates each allocation against its target SalesLedgerEntry's *current* balance (caller must recompute stale balances first, e.g. after removing a prior version's allocations on edit). */
async function validateAllocations(tx: Prisma.TransactionClient, companyId: string, allocations: ReceiptAllocationInput[]) {
  for (const alloc of allocations) {
    const entry = await tx.salesLedgerEntry.findFirst({
      where: { id: alloc.salesLedgerEntryId, companyId },
      select: { balance: true },
    })
    if (!entry) return "One or more sales records are invalid"
    if (alloc.amount > Number(entry.balance) + 0.001) {
      return "ALLOCATION_EXCEEDS_BALANCE"
    }
  }
  return null
}

export async function createLedgerEntry(data: LedgerEntryInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "general")) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = LedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { type, categoryId, newCategoryName, date, amount, paymentMethod, referenceNo, remark, customerId, allocations } = parsed.data

  // Allocating a receipt against Sales Ledger invoices is a distinct, server-enforced
  // permission — not just a hidden panel. The UI never sends allocations without
  // ledger.receipts.allocate, but a forged request must be rejected here too.
  if (allocations.length > 0 && !canAllocateReceipt(session.user.role as Role, session.user.modulePermissions)) {
    return { error: "Forbidden" }
  }

  try {
    const finalCategoryId =
      categoryId === NEW_CATEGORY_VALUE
        ? (await findOrCreateLedgerCategory(companyId, type, newCategoryName!)).id
        : categoryId

    const result = await prisma.$transaction(async (tx) => {
      if (type === "INCOME" && allocations.length > 0) {
        const validationError = await validateAllocations(tx, companyId, allocations)
        if (validationError) return { error: validationError }
      }

      const entry = await tx.ledgerEntry.create({
        data: {
          companyId,
          type,
          categoryId: finalCategoryId,
          date: new Date(`${date}T12:00:00`),
          amount,
          paymentMethod,
          referenceNo: referenceNo || null,
          remark: remark || null,
          customerId: type === "INCOME" && customerId ? customerId : null,
          createdById: userId,
        },
      })

      if (type === "INCOME" && allocations.length > 0) {
        await tx.receiptAllocation.createMany({
          data: allocations.map((a) => ({
            ledgerEntryId: entry.id,
            salesLedgerEntryId: a.salesLedgerEntryId,
            allocatedAmount: a.amount,
            createdById: userId,
          })),
        })
        for (const alloc of allocations) {
          await recomputeSalesLedgerEntry(tx, alloc.salesLedgerEntryId)
        }
      }

      return { success: true as const }
    })

    if ("error" in result) return result

    revalidatePath("/ledger/income-expense")
    revalidatePath("/ledger/sales")
    return { success: true as const }
  } catch {
    return { error: "Failed to save record" }
  }
}

export async function updateLedgerEntry(id: string, data: LedgerEntryInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canEditLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "general")) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = LedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { type, categoryId, newCategoryName, date, amount, paymentMethod, remark, customerId, allocations } = parsed.data

  if (allocations.length > 0 && !canAllocateReceipt(session.user.role as Role, session.user.modulePermissions)) {
    return { error: "Forbidden" }
  }

  try {
    const existing = await prisma.ledgerEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    const finalCategoryId =
      categoryId === NEW_CATEGORY_VALUE
        ? (await findOrCreateLedgerCategory(companyId, type, newCategoryName!)).id
        : categoryId

    const result = await prisma.$transaction(async (tx) => {
      // 1. Roll back this entry's existing allocations first, so the balance checks
      //    below (and any re-allocation to the same invoice) see accurate numbers —
      //    never additive on top of the entry's own prior contribution.
      const oldAllocations = await tx.receiptAllocation.findMany({
        where: { ledgerEntryId: id },
        select: { salesLedgerEntryId: true },
      })
      await tx.receiptAllocation.deleteMany({ where: { ledgerEntryId: id } })
      for (const old of oldAllocations) {
        await recomputeSalesLedgerEntry(tx, old.salesLedgerEntryId)
      }

      if (type === "INCOME" && allocations.length > 0) {
        const validationError = await validateAllocations(tx, companyId, allocations)
        if (validationError) return { error: validationError }
      }

      await tx.ledgerEntry.update({
        where: { id },
        data: {
          type,
          categoryId: finalCategoryId,
          date: new Date(`${date}T12:00:00`),
          amount,
          paymentMethod,
          // referenceNo intentionally omitted — preserves any legacy value stored in the DB
          remark: remark || null,
          customerId: type === "INCOME" && customerId ? customerId : null,
        },
      })

      if (type === "INCOME" && allocations.length > 0) {
        await tx.receiptAllocation.createMany({
          data: allocations.map((a) => ({
            ledgerEntryId: id,
            salesLedgerEntryId: a.salesLedgerEntryId,
            allocatedAmount: a.amount,
            createdById: userId,
          })),
        })
        for (const alloc of allocations) {
          await recomputeSalesLedgerEntry(tx, alloc.salesLedgerEntryId)
        }
      }

      return { success: true as const }
    })

    if ("error" in result) return result

    revalidatePath("/ledger/income-expense")
    revalidatePath("/ledger/sales")
    return { success: true as const }
  } catch {
    return { error: "Failed to update record" }
  }
}

export async function deleteLedgerEntry(id: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canDeleteLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "general")) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  try {
    const existing = await prisma.ledgerEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    await prisma.$transaction(async (tx) => {
      const allocations = await tx.receiptAllocation.findMany({
        where: { ledgerEntryId: id },
        select: { salesLedgerEntryId: true },
      })
      // ReceiptAllocation rows cascade-delete with the LedgerEntry (onDelete: Cascade),
      // but the SalesLedgerEntry rows they pointed at need an explicit recompute —
      // otherwise they'd keep showing this receipt's contribution as still paid.
      await tx.ledgerEntry.delete({ where: { id } })
      for (const alloc of allocations) {
        await recomputeSalesLedgerEntry(tx, alloc.salesLedgerEntryId)
      }
    })

    revalidatePath("/ledger/income-expense")
    revalidatePath("/ledger/sales")
    return { success: true as const }
  } catch {
    return { error: "Failed to delete record" }
  }
}

// ─── Sales Ledger ────────────────────────────────────────────────────────────────

export async function createSalesLedgerEntry(data: SalesLedgerEntryInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "sales")) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = SalesLedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { date, customerId, customerName, orderNo, invoiceAmount, amountReceived, remark } = parsed.data
  const { balance, status } = computeSalesLedgerStatus(invoiceAmount, amountReceived)
  const entryDate = new Date(`${date}T12:00:00`)
  const { referenceYear, referenceSequence } = parseSalesReference(orderNo, entryDate)

  try {
    await prisma.salesLedgerEntry.create({
      data: {
        companyId,
        date: entryDate,
        customerName,
        orderNo: orderNo || null,
        referenceYear,
        referenceSequence,
        invoiceAmount,
        amountReceived,
        balance,
        paymentStatus: status,
        remark: remark || null,
        createdById: userId,
        customerId: customerId || null,
      },
    })

    revalidatePath("/ledger/sales")
    return { success: true as const }
  } catch {
    return { error: "Failed to save record" }
  }
}

export async function updateSalesLedgerEntry(id: string, data: SalesLedgerEntryInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canEditLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "sales")) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = SalesLedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { date, customerId, customerName, orderNo, invoiceAmount, remark } = parsed.data
  const entryDate = new Date(`${date}T12:00:00`)
  const { referenceYear, referenceSequence } = parseSalesReference(orderNo, entryDate)

  try {
    const existing = await prisma.salesLedgerEntry.findFirst({
      where: { id, companyId },
      include: { _count: { select: { allocations: true } } },
    })
    if (!existing) return { error: "Record not found" }

    // Once any ReceiptAllocation rows exist for this entry, amountReceived/balance/status
    // are owned by recomputeSalesLedgerEntry() (driven off those rows) — this form must
    // not let a manual edit desync them. Entries with no allocations (pure legacy/manual
    // bookkeeping) keep the original manual-entry behavior.
    const hasAllocations = existing._count.allocations > 0
    const amountReceived = hasAllocations ? Number(existing.amountReceived) : parsed.data.amountReceived
    const { balance, status } = computeSalesLedgerStatus(invoiceAmount, amountReceived)

    await prisma.salesLedgerEntry.update({
      where: { id },
      data: {
        date: entryDate,
        customerName,
        orderNo: orderNo || null,
        referenceYear,
        referenceSequence,
        invoiceAmount,
        ...(hasAllocations ? {} : { amountReceived }),
        balance,
        paymentStatus: status,
        remark: remark || null,
        customerId: customerId || null,
      },
    })

    revalidatePath("/ledger/sales")
    return { success: true as const }
  } catch {
    return { error: "Failed to update record" }
  }
}

export async function setSalesLedgerEntryArchived(id: string, isArchived: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canEditLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "sales")) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  try {
    const existing = await prisma.salesLedgerEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    await prisma.salesLedgerEntry.update({ where: { id }, data: { isArchived } })
    revalidatePath("/ledger/sales")
    return { success: true as const }
  } catch {
    return { error: "Failed to update record" }
  }
}
