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
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
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

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.INVOICE,
    entityId: invoiceId,
    action: AUDIT_ACTIONS.CREATED,
    performedById: userId,
    metadata: { invoiceNumber, source: "FROM_QUOTATION", quotationId },
  })

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

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.INVOICE,
    entityId: invoiceId,
    action: AUDIT_ACTIONS.CREATED,
    performedById: userId,
    metadata: { invoiceNumber, source: "DIRECT" },
  })

  await syncInvoiceToDropboxBestEffort(invoiceId, companyId)

  redirect(`/quotations/invoices/${invoiceId}`)
}

/** Edits an invoice — only ever allowed while it's still DRAFT (mirrors updateQuotation's DRAFT/SENT-only rule), regardless of source. Works for both FROM_QUOTATION and DIRECT invoices. */
export async function updateInvoice(id: string, data: DirectInvoiceInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canEditInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = DirectInvoiceSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { customerId, customerPin, date, vatPercent, remarks, items } = parsed.data
  const invoiceNumber = normalizeBusinessNumber(parsed.data.invoiceNumber)

  try {
    const existing = await prisma.invoice.findFirst({ where: { id, companyId }, select: { status: true } })
    if (!existing) return { error: "Invoice not found" }
    if (existing.status !== "DRAFT") return { error: "Only draft invoices can be edited" }

    // Same ownership validation createDirectInvoice already has — customerId is
    // client-supplied and companyId comes only from the session, never the
    // request. Generic "not found" whether the id is missing, malformed, or
    // real-but-belongs-to-another-company — never distinguishable.
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } })
    if (!customer) return { error: "Customer not found" }

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

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.INVOICE,
    entityId: id,
    action: AUDIT_ACTIONS.UPDATED,
    performedById: userId,
    metadata: { invoiceNumber },
  })

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
  const userId = session.user.id as string

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
    select: { status: true, invoiceNumber: true, salesLedgerEntry: { select: { id: true } } },
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

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.INVOICE,
      entityId: id,
      action: AUDIT_ACTIONS.DELETED,
      performedById: userId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    })

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

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.SALES_LEDGER_ENTRY,
      entityId: entry.id,
      action: AUDIT_ACTIONS.CREATED,
      performedById: userId,
      metadata: { invoiceId, invoiceNumber: invoice.invoiceNumber },
    })

    return { success: true, id: entry.id }
  } catch (err) {
    console.error("createSalesLedgerFromInvoice failed:", err)
    return { error: "Failed to create sales record" }
  }
}

/**
 * Confirms a DRAFT invoice. Invoice is inventory-neutral (Delivery is the
 * system's only inventory-movement document — see src/lib/actions/deliveries.ts)
 * so this is now a pure status change: no stock is checked or deducted here.
 * `shortfalls` is kept on the return type for source compatibility with
 * existing callers (InvoiceActions' shortfall modal) but is never populated —
 * confirming an invoice can no longer fail on stock.
 *
 * Idempotent: an invoice that isn't currently DRAFT is rejected outright.
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
    select: { id: true, invoiceNumber: true, status: true },
  })
  if (!invoice) return { error: "Invoice not found" }
  if (invoice.status === "CONFIRMED") return { error: "Invoice is already confirmed" }
  if (invoice.status === "CANCELLED") return { error: "Invoice is already cancelled" }

  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "CONFIRMED", confirmedById: userId, confirmedAt: new Date() },
    })

    revalidatePath(`/quotations/invoices/${invoiceId}`)
    revalidatePath("/quotations/invoices")

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.INVOICE,
      entityId: invoiceId,
      action: AUDIT_ACTIONS.CONFIRMED,
      performedById: userId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    })

    return { success: true }
  } catch (err) {
    console.error("confirmInvoice failed:", err)
    return { error: "Failed to confirm invoice" }
  }
}

/**
 * Cancels an invoice. Invoice is inventory-neutral, so this is a pure status
 * change — nothing is restored here, whatever the invoice's prior status
 * (historical CONFIRMED invoices that deducted stock under the old rule are
 * NOT retroactively reconciled by this change; see the migration-boundary
 * note in the Delivery module report). Idempotent — an already-CANCELLED
 * invoice is rejected outright.
 */
export async function cancelInvoice(invoiceId: string): Promise<{ error: string } | { success: true }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCancelInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, invoiceNumber: true, status: true },
  })
  if (!invoice) return { error: "Invoice not found" }
  if (invoice.status === "CANCELLED") return { error: "Invoice is already cancelled" }

  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "CANCELLED", cancelledById: userId, cancelledAt: new Date() },
    })

    revalidatePath(`/quotations/invoices/${invoiceId}`)
    revalidatePath("/quotations/invoices")

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.INVOICE,
      entityId: invoiceId,
      action: AUDIT_ACTIONS.CANCELLED,
      performedById: userId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    })

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
  const userId = session.user.id as string

  const existing = await prisma.invoice.findFirst({ where: { id, companyId }, select: { id: true, invoiceNumber: true } })
  if (!existing) return { error: "Invoice not found" }

  const result = await syncInvoiceToDropbox(id, companyId)
  if (result.errors.length > 0) {
    console.error(`Invoice ${id} manual Dropbox retry had errors:`, result.errors)
  }

  if (result.skippedReason) return { error: result.skippedReason }
  if (result.synced.length === 0) return { error: result.errors[0] ?? "Failed to sync to Dropbox" }

  revalidatePath(`/quotations/invoices/${id}`)

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.INVOICE,
    entityId: id,
    action: AUDIT_ACTIONS.DROPBOX_RESYNCED,
    performedById: userId,
    metadata: { invoiceNumber: existing.invoiceNumber, synced: result.synced },
  })

  return { success: true as const, synced: result.synced }
}
