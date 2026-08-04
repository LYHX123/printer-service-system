"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  canCreateQuotation,
  canCreateInvoice,
  canEditInvoice,
  canDeleteInvoice,
  canConfirmInvoice,
  canCancelInvoice,
  canCreateSalesRecord,
} from "@/lib/permissions"
import { GenerateInvoiceSchema, DirectInvoiceSchema } from "@/lib/schemas"
import { extractTrailingNumber, normalizeBusinessNumber } from "@/lib/numbering"
import { computeSalesLedgerStatus } from "@/lib/ledger-utils"
import { getStockType } from "@/lib/stock-types"
import { syncInvoiceToDropbox } from "@/lib/invoiceExcel/dropboxSync"
import type { GenerateInvoiceInput, DirectInvoiceInput } from "@/lib/schemas"
import type { Role } from "@/types"

/**
 * Best-effort Dropbox sync, shared by every place that creates or edits an
 * Invoice's content — the Invoice record itself is already safely committed
 * by the time this runs, so a Dropbox hiccup (not connected, LibreOffice
 * unavailable, upload failed, ...) is only ever logged, never surfaced as a
 * failure of the calling action. See resyncInvoiceDropbox for the manual
 * retry story (same underlying function).
 */
async function syncInvoiceToDropboxBestEffort(invoiceId: string, companyId: string): Promise<void> {
  try {
    const result = await syncInvoiceToDropbox(invoiceId, companyId)
    if (result.errors.length > 0) {
      console.error(`Invoice ${invoiceId} Dropbox sync had errors:`, result.errors)
    }
  } catch (err) {
    console.error(`Invoice ${invoiceId} Dropbox sync failed:`, err)
  }
}

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
  const { date, customerPin, vatPercent } = parsed.data
  const invoiceNumber = normalizeBusinessNumber(parsed.data.invoiceNumber)

  let invoiceId: string
  try {
    // Invoices can be generated from a quotation at any status — generation never
    // changes the quotation's own status (that remains a separate, user-driven action).
    // At most one Invoice per Quotation (quotationId is @unique) — the quotation detail
    // page only offers this action when quotation.invoice is still null.
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, companyId },
      include: {
        customer: { select: { id: true, companyName: true } },
        items: { include: { part: { select: { id: true, name: true, brand: true, unit: true } } } },
        invoice: { select: { id: true } },
      },
    })
    if (!quotation) return { error: "Quotation not found" }
    if (quotation.invoice) return { error: "This quotation already has an invoice" }

    const existingNumber = await prisma.invoice.findUnique({ where: { invoiceNumber } })
    if (existingNumber) return { error: "INVOICE_NUMBER_EXISTS" }

    const subtotal = Number(quotation.subtotal)
    const vatAmount = (subtotal * vatPercent) / 100
    const totalAmount = subtotal + vatAmount
    const invoiceDate = new Date(`${date}T12:00:00`)

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceSortNumber: extractTrailingNumber(invoiceNumber),
        source: "FROM_QUOTATION",
        status: "DRAFT",
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
            // Prefer the Quotation's own frozen snapshot over the live Stock
            // value — the Quotation is already the source of truth by the
            // time it's invoiced (matches the stockCategory/brand/etc. lines
            // below, which all carry forward the Quotation's snapshot too).
            unit: item.unitSnapshot ?? item.part?.unit ?? null,
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

    invoiceId = invoice.id

    revalidatePath(`/quotations/${quotationId}`)
    revalidatePath("/quotations/invoices")
  } catch (err) {
    console.error("generateInvoice failed:", err)
    return { error: "Failed to generate invoice" }
  }

  await syncInvoiceToDropboxBestEffort(invoiceId, companyId)

  redirect(`/quotations/invoices/${invoiceId}`)
}

/** Creates an invoice with no Quotation — items are picked directly from Stock. Always born DRAFT (source = DIRECT), same as generateInvoice(). */
export async function createDirectInvoice(data: DirectInvoiceInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = DirectInvoiceSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { customerId, customerPin, date, vatPercent, remarks, items } = parsed.data
  const invoiceNumber = normalizeBusinessNumber(parsed.data.invoiceNumber)

  let invoiceId: string
  try {
    const existingNumber = await prisma.invoice.findUnique({ where: { invoiceNumber } })
    if (existingNumber) return { error: "INVOICE_NUMBER_EXISTS" }

    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } })
    if (!customer) return { error: "Customer not found" }

    const parts = await prisma.sparePart.findMany({
      where: { id: { in: items.map((i) => i.partId) }, companyId },
      select: { id: true, name: true, brand: true, model: true, specification: true, category: true, unit: true },
    })
    const partMap = new Map(parts.map((p) => [p.id, p]))
    if (parts.length !== new Set(items.map((i) => i.partId)).size) {
      return { error: "One or more stock items are invalid" }
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const vatAmount = (subtotal * vatPercent) / 100
    const totalAmount = subtotal + vatAmount
    const invoiceDate = new Date(`${date}T12:00:00`)

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceSortNumber: extractTrailingNumber(invoiceNumber),
        source: "DIRECT",
        status: "DRAFT",
        companyId,
        quotationId: null,
        customerId,
        customerPin: customerPin || null,
        date: invoiceDate,
        subtotal,
        vatPercent,
        vatAmount,
        totalAmount,
        remarks: remarks || null,
        createdById: userId,
        items: {
          create: items.map((item) => {
            const part = partMap.get(item.partId)!
            return {
              partId: item.partId,
              description: [part.brand, part.name].filter(Boolean).join(" "),
              unit: part.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
              // Frozen snapshot, same rationale as QuotationItem/generateInvoice's items —
              // later edits to the SparePart record must never change a past invoice's wording.
              stockCategory: getStockType(part.category),
              brandSnapshot: part.brand,
              nameSnapshot: part.name,
              modelSnapshot: part.model,
              specificationSnapshot: part.specification,
            }
          }),
        },
      },
      select: { id: true },
    })

    invoiceId = invoice.id
    revalidatePath("/quotations/invoices")
  } catch (err) {
    console.error("createDirectInvoice failed:", err)
    return { error: "Failed to create invoice" }
  }

  await syncInvoiceToDropboxBestEffort(invoiceId, companyId)

  redirect(`/quotations/invoices/${invoiceId}`)
}

/** Edits an invoice — only ever allowed while it's still DRAFT (mirrors updateQuotation's DRAFT/SENT-only rule), regardless of source. Works for both FROM_QUOTATION and DIRECT invoices. */
export async function updateInvoice(id: string, data: DirectInvoiceInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canEditInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = DirectInvoiceSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { customerId, customerPin, date, vatPercent, remarks, items } = parsed.data
  const invoiceNumber = normalizeBusinessNumber(parsed.data.invoiceNumber)

  try {
    const existing = await prisma.invoice.findFirst({ where: { id, companyId }, select: { status: true } })
    if (!existing) return { error: "Invoice not found" }
    if (existing.status !== "DRAFT") return { error: "Only draft invoices can be edited" }

    const existingNumber = await prisma.invoice.findFirst({
      where: { invoiceNumber, companyId, NOT: { id } },
      select: { id: true },
    })
    if (existingNumber) return { error: "INVOICE_NUMBER_EXISTS" }

    const parts = await prisma.sparePart.findMany({
      where: { id: { in: items.map((i) => i.partId) }, companyId },
      select: { id: true, name: true, brand: true, model: true, specification: true, category: true, unit: true },
    })
    const partMap = new Map(parts.map((p) => [p.id, p]))
    if (parts.length !== new Set(items.map((i) => i.partId)).size) {
      return { error: "One or more stock items are invalid" }
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const vatAmount = (subtotal * vatPercent) / 100
    const totalAmount = subtotal + vatAmount
    const invoiceDate = new Date(`${date}T12:00:00`)

    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
      await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber,
          invoiceSortNumber: extractTrailingNumber(invoiceNumber),
          customerId,
          customerPin: customerPin || null,
          date: invoiceDate,
          subtotal,
          vatPercent,
          vatAmount,
          totalAmount,
          remarks: remarks || null,
        },
      })
      if (items.length > 0) {
        await tx.invoiceItem.createMany({
          data: items.map((item) => {
            const part = partMap.get(item.partId)!
            return {
              invoiceId: id,
              partId: item.partId,
              description: [part.brand, part.name].filter(Boolean).join(" "),
              unit: part.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
              stockCategory: getStockType(part.category),
              brandSnapshot: part.brand,
              nameSnapshot: part.name,
              modelSnapshot: part.model,
              specificationSnapshot: part.specification,
            }
          }),
        })
      }
    })

    revalidatePath(`/quotations/invoices/${id}`)
    revalidatePath("/quotations/invoices")
  } catch (err) {
    console.error("updateInvoice failed:", err)
    return { error: "Failed to update invoice" }
  }

  // Re-sync (in place, no versioning — see the InvoiceDocument schema
  // comment) so an already-synced Dropbox copy never goes stale after an
  // edit. Not a new "Invoice Adjust" feature — updateInvoice already existed
  // and already only ever runs while the invoice is still DRAFT.
  await syncInvoiceToDropboxBestEffort(id, companyId)

  redirect(`/quotations/invoices/${id}`)
}

/**
 * Deletes an invoice. Allowed only when DRAFT (never deducted stock) or CANCELLED
 * (stock already reversed by cancelInvoice) — a CONFIRMED invoice must be cancelled
 * first. Also blocked outright if a Sales Ledger record already exists for it (no
 * "unlink" flow in this round — the error tells the caller why).
 */
export async function deleteInvoice(id: string): Promise<{ error: string } | { success: true }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canDeleteInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
    select: { status: true, salesLedgerEntry: { select: { id: true } } },
  })
  if (!invoice) return { error: "Invoice not found" }
  if (invoice.salesLedgerEntry) {
    return { error: "This invoice is linked to a Sales Ledger record and cannot be deleted" }
  }
  if (invoice.status !== "DRAFT" && invoice.status !== "CANCELLED") {
    return { error: "Only draft or cancelled invoices can be deleted" }
  }

  try {
    await prisma.invoice.delete({ where: { id } })
    revalidatePath("/quotations/invoices")
    return { success: true }
  } catch (err) {
    console.error("deleteInvoice failed:", err)
    return { error: "Failed to delete invoice" }
  }
}

/**
 * Converts an Invoice into a Sales Ledger entry — an explicit, one-time action
 * (not automatic on invoice generation). Duplicate-prevention is enforced at the
 * DB level (SalesLedgerEntry.invoiceId is @unique); the upfront check here just
 * gives a friendlier error than a raw constraint violation.
 */
export async function createSalesLedgerFromInvoice(
  invoiceId: string
): Promise<{ error: string } | { success: true; id: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateSalesRecord(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      customer: { select: { id: true, companyName: true } },
      salesLedgerEntry: { select: { id: true } },
    },
  })
  if (!invoice) return { error: "Invoice not found" }
  if (invoice.salesLedgerEntry) return { error: "This invoice already has a Sales Ledger record" }

  try {
    const totalAmount = Number(invoice.totalAmount)
    const { balance, status } = computeSalesLedgerStatus(totalAmount, 0)
    const entry = await prisma.salesLedgerEntry.create({
      data: {
        companyId,
        date: invoice.date,
        customerName: invoice.customer.companyName,
        customerId: invoice.customerId,
        orderNo: invoice.invoiceNumber,
        referenceSequence: invoice.invoiceSortNumber,
        invoiceAmount: totalAmount,
        amountReceived: 0,
        balance,
        paymentStatus: status,
        remark: `Invoice ${invoice.invoiceNumber}`,
        invoiceId: invoice.id,
        createdById: userId,
      },
      select: { id: true },
    })

    revalidatePath(`/quotations/invoices/${invoiceId}`)
    revalidatePath("/ledger/sales")
    return { success: true, id: entry.id }
  } catch (err) {
    console.error("createSalesLedgerFromInvoice failed:", err)
    return { error: "Failed to create sales record" }
  }
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
 * Every new invoice (from either source — generateInvoice or createDirectInvoice)
 * is born DRAFT; this is the only path that ever deducts stock. Invoices created
 * before this workflow existed were backfilled to CONFIRMED without retroactive
 * stock movement (see the migration that added this column).
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

/**
 * Manual retry for the best-effort sync that generateInvoice/
 * createDirectInvoice/updateInvoice already attempt automatically — for
 * when that attempt failed (Dropbox briefly unreachable, LibreOffice
 * unavailable, ...) or was skipped (Dropbox not connected at all yet).
 * Always re-targets the invoice's current file (no versioning to advance —
 * see the InvoiceDocument schema comment), so retrying is idempotent.
 */
export async function resyncInvoiceDropbox(
  id: string
): Promise<{ error: string } | { success: true; synced: ("PDF" | "XLSX")[] }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canEditInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const existing = await prisma.invoice.findFirst({ where: { id, companyId }, select: { id: true } })
  if (!existing) return { error: "Invoice not found" }

  const result = await syncInvoiceToDropbox(id, companyId)
  if (result.errors.length > 0) {
    console.error(`Invoice ${id} manual Dropbox retry had errors:`, result.errors)
  }

  if (result.skippedReason) return { error: result.skippedReason }
  if (result.synced.length === 0) return { error: result.errors[0] ?? "Failed to sync to Dropbox" }

  revalidatePath(`/quotations/invoices/${id}`)
  return { success: true as const, synced: result.synced }
}
