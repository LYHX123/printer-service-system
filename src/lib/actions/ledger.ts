"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LedgerEntrySchema, SalesLedgerEntrySchema } from "@/lib/schemas"
import { canManageLedger } from "@/lib/permissions"
import { findOrCreateLedgerCategory } from "@/lib/data/ledger"
import { computeSalesLedgerStatus } from "@/lib/ledger-utils"
import type { LedgerEntryInput, SalesLedgerEntryInput } from "@/lib/schemas"
import type { Role } from "@/types"

const NEW_CATEGORY_VALUE = "__new__"

// ─── Income & Expense Book ──────────────────────────────────────────────────────

export async function createLedgerEntry(data: LedgerEntryInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageLedger(session.user.role as Role)) return { error: "Forbidden" }
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
  if (!canManageLedger(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = LedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { type, categoryId, newCategoryName, date, amount, paymentMethod, referenceNo, remark } = parsed.data

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
        referenceNo: referenceNo || null,
        remark: remark || null,
      },
    })

    revalidatePath("/ledger/income-expense")
    return { success: true as const }
  } catch {
    return { error: "Failed to update record" }
  }
}

export async function setLedgerEntryArchived(id: string, isArchived: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageLedger(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  try {
    const existing = await prisma.ledgerEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    await prisma.ledgerEntry.update({ where: { id }, data: { isArchived } })
    revalidatePath("/ledger/income-expense")
    return { success: true as const }
  } catch {
    return { error: "Failed to update record" }
  }
}

// ─── Sales Ledger ────────────────────────────────────────────────────────────────

export async function createSalesLedgerEntry(data: SalesLedgerEntryInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageLedger(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = SalesLedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { date, customerName, orderNo, invoiceAmount, amountReceived, remark } = parsed.data
  const { balance, status } = computeSalesLedgerStatus(invoiceAmount, amountReceived)

  try {
    await prisma.salesLedgerEntry.create({
      data: {
        companyId,
        date: new Date(`${date}T12:00:00`),
        customerName,
        orderNo: orderNo || null,
        invoiceAmount,
        amountReceived,
        balance,
        paymentStatus: status,
        remark: remark || null,
        createdById: userId,
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
  if (!canManageLedger(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = SalesLedgerEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { date, customerName, orderNo, invoiceAmount, amountReceived, remark } = parsed.data
  const { balance, status } = computeSalesLedgerStatus(invoiceAmount, amountReceived)

  try {
    const existing = await prisma.salesLedgerEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    await prisma.salesLedgerEntry.update({
      where: { id },
      data: {
        date: new Date(`${date}T12:00:00`),
        customerName,
        orderNo: orderNo || null,
        invoiceAmount,
        amountReceived,
        balance,
        paymentStatus: status,
        remark: remark || null,
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
  if (!canManageLedger(session.user.role as Role)) return { error: "Forbidden" }
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
