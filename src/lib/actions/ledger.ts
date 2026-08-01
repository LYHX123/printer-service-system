"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LedgerEntrySchema, SalesLedgerEntrySchema } from "@/lib/schemas"
import { canCreateLedgerEntryPerm, canEditLedgerEntryPerm, canDeleteLedgerEntryPerm } from "@/lib/permissions"
import { findOrCreateLedgerCategory } from "@/lib/data/ledger"
import { computeSalesLedgerStatus } from "@/lib/ledger-utils"
import { parseSalesReference } from "@/lib/ledger-reference"
import type { LedgerEntryInput, SalesLedgerEntryInput } from "@/lib/schemas"
import type { Role } from "@/types"

const NEW_CATEGORY_VALUE = "__new__"

// ─── Income & Expense Book ──────────────────────────────────────────────────────

export async function createLedgerEntry(data: LedgerEntryInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "general")) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = LedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { type, categoryId, newCategoryName, date, amount, paymentMethod, referenceNo, remark } = parsed.data

  try {
    const finalCategoryId =
      categoryId === NEW_CATEGORY_VALUE
        ? (await findOrCreateLedgerCategory(companyId, type, newCategoryName!)).id
        : categoryId

    await prisma.ledgerEntry.create({
      data: {
        companyId,
        type,
        categoryId: finalCategoryId,
        date: new Date(`${date}T12:00:00`),
        amount,
        paymentMethod,
        referenceNo: referenceNo || null,
        remark: remark || null,
        createdById: userId,
      },
    })

    revalidatePath("/ledger/income-expense")
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

  const parsed = LedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { type, categoryId, newCategoryName, date, amount, paymentMethod, remark } = parsed.data

  try {
    const existing = await prisma.ledgerEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    const finalCategoryId =
      categoryId === NEW_CATEGORY_VALUE
        ? (await findOrCreateLedgerCategory(companyId, type, newCategoryName!)).id
        : categoryId

    await prisma.ledgerEntry.update({
      where: { id },
      data: {
        type,
        categoryId: finalCategoryId,
        date: new Date(`${date}T12:00:00`),
        amount,
        paymentMethod,
        // referenceNo intentionally omitted — preserves any legacy value stored in the DB
        remark: remark || null,
      },
    })

    revalidatePath("/ledger/income-expense")
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

    await prisma.ledgerEntry.delete({ where: { id } })
    revalidatePath("/ledger/income-expense")
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ customerId: customerId || null } as any),
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
  const { date, customerId, customerName, orderNo, invoiceAmount, amountReceived, remark } = parsed.data
  const { balance, status } = computeSalesLedgerStatus(invoiceAmount, amountReceived)
  const entryDate = new Date(`${date}T12:00:00`)
  const { referenceYear, referenceSequence } = parseSalesReference(orderNo, entryDate)

  try {
    const existing = await prisma.salesLedgerEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    await prisma.salesLedgerEntry.update({
      where: { id },
      data: {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ customerId: customerId || null } as any),
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
