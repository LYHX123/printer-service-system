"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canCreateQuotation, canConfirmInvoice, canCancelInvoice } from "@/lib/permissions"
import { GenerateInvoiceSchema } from "@/lib/schemas"
import { computeSalesLedgerStatus } from "@/lib/ledger-utils"
import type { GenerateInvoiceInput } from "@/lib/schemas"
import type { Role } from "@/types"

export type StockShortfall = {
  partId: string
  name: string
  have: number
  need: number
  short: number
}

export async function generateInvoice(quotationId: string, data: GenerateInvoiceInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateQuotation(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = GenerateInvoiceSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { invoiceNumber, date, customerPin, vatPercent } = parsed.data

  let invoiceId: string
  try {
    // Invoices can be generated from a quotation at any status — generation never
    // changes the quotation's own status (that remains a separate, user-driven action).
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, companyId },
      include: {
        customer: { select: { id: true, companyName: true } },
        items: { include: { part: { select: { id: true, name: true, brand: true, unit: true } } } },
      },
    })
    if (!quotation) return { error: "Quotation not found" }

    const existingNumber = await prisma.invoice.findUnique({ where: { invoiceNumber } })
    if (existingNumber) return { error: "Invoice number already in use" }

    const subtotal = Number(quotation.subtotal)
    const vatAmount = (subtotal * vatPercent) / 100
    const totalAmount = subtotal + vatAmount
    const invoiceDate = new Date(`${date}T12:00:00`)

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          companyId,
          quotationId,
          customerId: quotation.customerId,
          customerPin: customerPin || null,
          date: invoiceDate,
          subtotal,
          vatPercent,
          vatAmount,
          totalAmount,
          createdById: userId,
          items: {
            create: quotation.items.map((item) => ({
              partId: item.partId,
              description: item.part
                ? [item.part.brand, item.part.name].filter(Boolean).join(" ")
                : (item.description ?? ""),
              unit: item.part?.unit ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.subtotal,
              // Carried forward from the quotation's own frozen snapshot — the
              // quotation is already the source of truth by the time it's invoiced.
              stockCategory: item.stockCategory,
              brandSnapshot: item.brandSnapshot,
              nameSnapshot: item.nameSnapshot,
              modelSnapshot: item.modelSnapshot,
              specificationSnapshot: item.specificationSnapshot,
            })),
          },
        },
        select: { id: true },
      })

      // Optional: mirror the invoice into the Sales Ledger as a fresh unpaid entry.
      const { balance, status } = computeSalesLedgerStatus(totalAmount, 0)
      await tx.salesLedgerEntry.create({
        data: {
          companyId,
          date: invoiceDate,
          customerName: quotation.customer.companyName,
          customerId: quotation.customerId,
          orderNo: invoiceNumber,
          invoiceAmount: totalAmount,
          amountReceived: 0,
          balance,
          paymentStatus: status,
          remark: `Invoice ${invoiceNumber} for Quotation ${quotation.quotationNumber}`,
          createdById: userId,
        },
      })

      return created
    })

    invoiceId = invoice.id

    revalidatePath(`/quotations/${quotationId}`)
    revalidatePath("/quotations/invoices")
    revalidatePath("/ledger/sales")
  } catch (err) {
    console.error("generateInvoice failed:", err)
    return { error: "Failed to generate invoice" }
  }

  redirect(`/quotations/invoices/${invoiceId}`)
}

/**
 * Confirms a DRAFT invoice, deducting stock for every stock-linked item in a
 * single transaction. All-or-nothing: if ANY item lacks sufficient stock, the
 * whole confirmation is rejected (no partial deduction) and the shortfalls are
 * reported back so the caller can display exactly what's short.
 *
 * Idempotent: an invoice that isn't currently DRAFT is rejected outright, so
 * calling this twice on the same invoice can never deduct stock twice.
 *
 * Note: today's `generateInvoice()` still creates invoices as CONFIRMED
 * immediately (unchanged legacy behavior — that flow has never deducted stock
 * and isn't part of this round's scope). This function exists for the future
 * DRAFT-first workflow described in the upgrade spec; it is not wired to any
 * UI button yet.
 */
export async function confirmInvoice(
  invoiceId: string
): Promise<{ error: string; shortfalls?: StockShortfall[] } | { success: true }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canConfirmInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: { items: { include: { part: { select: { id: true, name: true, brand: true } } } } },
  })
  if (!invoice) return { error: "Invoice not found" }
  if (invoice.status === "CONFIRMED") return { error: "Invoice is already confirmed" }
  if (invoice.status === "CANCELLED") return { error: "Invoice is already cancelled" }

  const stockItems = invoice.items.filter((item) => item.partId)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const shortfalls: StockShortfall[] = []
      const stocks = await tx.inventoryStock.findMany({
        where: { partId: { in: stockItems.map((i) => i.partId!) } },
      })
      const stockByPart = new Map(stocks.map((s) => [s.partId, s]))

      for (const item of stockItems) {
        const have = stockByPart.get(item.partId!)?.quantity ?? 0
        if (have < item.quantity) {
          shortfalls.push({
            partId: item.partId!,
            name: item.part ? [item.part.brand, item.part.name].filter(Boolean).join(" ") : item.description,
            have,
            need: item.quantity,
            short: item.quantity - have,
          })
        }
      }

      if (shortfalls.length > 0) {
        return { shortfalls }
      }

      for (const item of stockItems) {
        const have = stockByPart.get(item.partId!)!.quantity
        const after = have - item.quantity
        await tx.inventoryStock.update({ where: { partId: item.partId! }, data: { quantity: after } })
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            partId: item.partId!,
            type: "OUT",
            quantity: -item.quantity,
            quantityBefore: have,
            quantityAfter: after,
            referenceType: "INVOICE",
            reference: `Invoice ${invoice.invoiceNumber}`,
            performedById: userId,
          },
        })
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "CONFIRMED", confirmedById: userId, confirmedAt: new Date() },
      })

      return { shortfalls: [] as StockShortfall[] }
    })

    if (result.shortfalls.length > 0) {
      return { error: "Insufficient stock for one or more items", shortfalls: result.shortfalls }
    }

    revalidatePath(`/quotations/invoices/${invoiceId}`)
    revalidatePath("/quotations/invoices")
    revalidatePath("/stock")
    return { success: true }
  } catch (err) {
    console.error("confirmInvoice failed:", err)
    return { error: "Failed to confirm invoice" }
  }
}

/**
 * Cancels an invoice. If it was CONFIRMED (stock already deducted), every
 * stock-linked item's quantity is restored and a REVERSAL transaction is
 * written; if it was still DRAFT, nothing was ever deducted so cancellation
 * is a pure status change. Idempotent for the same reason as confirmInvoice —
 * an already-CANCELLED invoice is rejected outright.
 */
export async function cancelInvoice(invoiceId: string): Promise<{ error: string } | { success: true }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCancelInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: { items: true },
  })
  if (!invoice) return { error: "Invoice not found" }
  if (invoice.status === "CANCELLED") return { error: "Invoice is already cancelled" }

  const wasConfirmed = invoice.status === "CONFIRMED"
  const stockItems = invoice.items.filter((item) => item.partId)

  try {
    await prisma.$transaction(async (tx) => {
      if (wasConfirmed) {
        const stocks = await tx.inventoryStock.findMany({
          where: { partId: { in: stockItems.map((i) => i.partId!) } },
        })
        const stockByPart = new Map(stocks.map((s) => [s.partId, s]))

        for (const item of stockItems) {
          const have = stockByPart.get(item.partId!)?.quantity ?? 0
          const after = have + item.quantity
          await tx.inventoryStock.upsert({
            where: { partId: item.partId! },
            update: { quantity: after },
            create: { partId: item.partId!, quantity: after },
          })
          await tx.inventoryTransaction.create({
            data: {
              companyId,
              partId: item.partId!,
              type: "REVERSAL",
              quantity: item.quantity,
              quantityBefore: have,
              quantityAfter: after,
              referenceType: "INVOICE_CANCEL",
              reference: `Invoice ${invoice.invoiceNumber} cancelled`,
              performedById: userId,
            },
          })
        }
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "CANCELLED", cancelledById: userId, cancelledAt: new Date() },
      })
    })

    revalidatePath(`/quotations/invoices/${invoiceId}`)
    revalidatePath("/quotations/invoices")
    revalidatePath("/stock")
    return { success: true }
  } catch (err) {
    console.error("cancelInvoice failed:", err)
    return { error: "Failed to cancel invoice" }
  }
}
