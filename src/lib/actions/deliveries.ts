"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  canCreateDelivery,
  canEditDelivery,
  canDeleteDelivery,
  canSyncDelivery,
  canConvertDeliveryToInvoice,
} from "@/lib/permissions"
import { DeliverySchema, ConvertQuotationToDeliverySchema, DirectInvoiceSchema } from "@/lib/schemas"
import { extractTrailingNumber, normalizeBusinessNumber } from "@/lib/numbering"
import { generateDeliveryNumber } from "@/lib/utils"
import { getStockType } from "@/lib/stock-types"
import { syncDeliveryToDropbox } from "@/lib/deliveryExcel"
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import type { DeliveryInput, ConvertQuotationToDeliveryInput, DirectInvoiceInput } from "@/lib/schemas"
import type { Role } from "@/types"

export type StockShortfall = {
  partId: string
  name: string
  have: number
  need: number
  short: number
}

type PartLite = {
  id: string
  name: string
  brand: string | null
  model: string | null
  specification: string | null
  unit: string | null
  category: import("@/types").PartCategory
}

/**
 * Extremely unlikely collision guard (e.g. concurrent creates) — bump until
 * unique. Mirrors createSparePart's own partNumber generation exactly (see
 * src/lib/actions/inventory.ts).
 */
async function generateUniqueDeliveryNumber(companyId: string): Promise<string> {
  let finalNumber = generateDeliveryNumber((await prisma.delivery.count({ where: { companyId } })) + 1)
  for (let attempt = 0; await prisma.delivery.findUnique({ where: { deliveryNumber: finalNumber } }); attempt++) {
    finalNumber = generateDeliveryNumber((await prisma.delivery.count({ where: { companyId } })) + 1 + attempt + 1)
  }
  return finalNumber
}

/** Validates every partId belongs to this company and returns a lookup map — null if any id is missing/foreign. */
async function loadValidatedParts(companyId: string, items: { partId: string }[]): Promise<Map<string, PartLite> | null> {
  const parts = await prisma.sparePart.findMany({
    where: { id: { in: items.map((i) => i.partId) }, companyId },
    select: { id: true, name: true, brand: true, model: true, specification: true, unit: true, category: true },
  })
  if (parts.length !== new Set(items.map((i) => i.partId)).size) return null
  return new Map(parts.map((p) => [p.id, p]))
}

/**
 * Sums quantities per partId — a Delivery/Quotation can in principle list the
 * same stock item on more than one line, and stock must only ever be
 * checked/moved ONCE per part for its combined total, never once per line
 * (which would silently under- or over-count against a stale in-memory
 * snapshot read before any of that part's lines were applied).
 */
function aggregateQuantitiesByPart(items: { partId: string; quantity: number }[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const item of items) {
    out.set(item.partId, (out.get(item.partId) ?? 0) + item.quantity)
  }
  return out
}

function describePart(partId: string, partMap: Map<string, PartLite>): string {
  const part = partMap.get(partId)
  return part ? [part.brand, part.name].filter(Boolean).join(" ") : partId
}

/**
 * Checks a part-aggregated deduction plan against current stock, all-or-
 * nothing (same rule as confirmInvoice's old shortfall check): if ANY part is
 * short, nothing is deducted for any of them.
 */
function computeShortfalls(
  qtyByPart: Map<string, number>,
  stockByPart: Map<string, { quantity: number }>,
  partMap: Map<string, PartLite>
): StockShortfall[] {
  const shortfalls: StockShortfall[] = []
  for (const [partId, qty] of qtyByPart) {
    const have = stockByPart.get(partId)?.quantity ?? 0
    if (have < qty) {
      shortfalls.push({ partId, name: describePart(partId, partMap), have, need: qty, short: qty - have })
    }
  }
  return shortfalls
}

// ─── Manual Delivery creation ──────────────────────────────────────────────────

/**
 * Creates a Delivery and, in the same transaction, deducts stock for every
 * item exactly once (see aggregateQuantitiesByPart). All-or-nothing: if ANY
 * item lacks sufficient stock, nothing is created and nothing is deducted —
 * the shortfalls are reported back so the caller can display exactly what's
 * short (matches the old confirmInvoice's shortfall UX).
 */
export async function createDelivery(data: DeliveryInput): Promise<{ error: string; shortfalls?: StockShortfall[] } | never> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateDelivery(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = DeliverySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { deliveryDate, customerId, customerBranchId, reference, items } = parsed.data

  let deliveryId: string
  let deliveryNumber = ""
  try {
    const ownedCustomer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } })
    if (!ownedCustomer) return { error: "Customer not found" }

    let validatedBranchId: string | null = null
    if (customerBranchId) {
      const ownedBranch = await prisma.customerBranch.findFirst({
        where: { id: customerBranchId, customerId, companyId },
        select: { id: true },
      })
      if (!ownedBranch) return { error: "Customer branch not found" }
      validatedBranchId = ownedBranch.id
    }

    const partMap = await loadValidatedParts(companyId, items)
    if (!partMap) return { error: "One or more stock items are invalid" }

    deliveryNumber = await generateUniqueDeliveryNumber(companyId)
    const deliveryDateValue = new Date(`${deliveryDate}T12:00:00`)
    const qtyByPart = aggregateQuantitiesByPart(items)

    const result = await prisma.$transaction(async (tx) => {
      const stocks = await tx.inventoryStock.findMany({ where: { partId: { in: [...qtyByPart.keys()] } } })
      const stockByPart = new Map(stocks.map((s) => [s.partId, s]))

      const shortfalls = computeShortfalls(qtyByPart, stockByPart, partMap)
      if (shortfalls.length > 0) return { shortfalls, id: null as string | null }

      const delivery = await tx.delivery.create({
        data: {
          deliveryNumber,
          deliverySortNumber: extractTrailingNumber(deliveryNumber),
          companyId,
          customerId,
          customerBranchId: validatedBranchId,
          quotationId: null,
          reference: reference || null,
          deliveryDate: deliveryDateValue,
          createdById: userId,
          items: {
            create: items.map((item) => {
              const part = partMap.get(item.partId)!
              return {
                partId: item.partId,
                description: [part.brand, part.name].filter(Boolean).join(" "),
                quantity: item.quantity,
                stockCategory: getStockType(part.category),
                brandSnapshot: part.brand,
                nameSnapshot: part.name,
                modelSnapshot: part.model,
                specificationSnapshot: part.specification,
                unitSnapshot: part.unit,
              }
            }),
          },
        },
        select: { id: true },
      })

      for (const [partId, qty] of qtyByPart) {
        const have = stockByPart.get(partId)?.quantity ?? 0
        const after = have - qty
        await tx.inventoryStock.update({ where: { partId }, data: { quantity: after } })
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            partId,
            type: "OUT",
            quantity: -qty,
            quantityBefore: have,
            quantityAfter: after,
            referenceType: "DELIVERY",
            reference: `Delivery ${deliveryNumber}`,
            performedById: userId,
          },
        })
      }

      return { shortfalls: [] as StockShortfall[], id: delivery.id }
    })

    if (result.shortfalls.length > 0) {
      return { error: "Insufficient stock for one or more items", shortfalls: result.shortfalls }
    }
    deliveryId = result.id!

    revalidatePath("/delivery")
    revalidatePath("/stock")
  } catch (err) {
    console.error("createDelivery failed:", err)
    return { error: "Failed to create delivery" }
  }

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.DELIVERY,
    entityId: deliveryId,
    action: AUDIT_ACTIONS.CREATED,
    performedById: userId,
    metadata: { deliveryNumber, itemCount: items.length },
  })

  redirect(`/delivery/${deliveryId}`)
}

// ─── Create Delivery from Quotation ────────────────────────────────────────────

/**
 * Creates a Delivery from a Quotation's own items/quantities/stock
 * relationships — never modifies the Quotation itself. A Quotation may have
 * many Deliveries over time (no uniqueness constraint), unlike
 * Quotation -> Invoice which is capped at one. Same all-or-nothing stock
 * deduction as createDelivery.
 */
export async function createDeliveryFromQuotation(
  quotationId: string,
  data: ConvertQuotationToDeliveryInput
): Promise<{ error: string; shortfalls?: StockShortfall[] } | never> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateDelivery(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = ConvertQuotationToDeliverySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { deliveryDate, reference } = parsed.data

  let deliveryId: string
  let deliveryNumber = ""
  try {
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, companyId },
      select: {
        id: true,
        quotationNumber: true,
        customerId: true,
        customerBranchId: true,
        items: {
          select: {
            partId: true,
            description: true,
            quantity: true,
            stockCategory: true,
            brandSnapshot: true,
            nameSnapshot: true,
            modelSnapshot: true,
            specificationSnapshot: true,
            unitSnapshot: true,
          },
        },
      },
    })
    if (!quotation) return { error: "Quotation not found" }

    // Every current-generation Quotation item is stock-linked (partId set) —
    // a legacy free-text item (partId null) predates that rule and has no
    // Stock relationship to deduct against, so it's skipped rather than
    // failing the whole conversion (a legacy quotation may mix both kinds).
    const stockItems = quotation.items.filter((i): i is typeof quotation.items[number] & { partId: string } => Boolean(i.partId))
    if (stockItems.length === 0) return { error: "This quotation has no stock-linked items to deliver" }

    deliveryNumber = await generateUniqueDeliveryNumber(companyId)
    const deliveryDateValue = new Date(`${deliveryDate}T12:00:00`)
    const qtyByPart = aggregateQuantitiesByPart(stockItems.map((i) => ({ partId: i.partId, quantity: i.quantity })))
    const nameByPart = new Map(stockItems.map((i) => [i.partId, [i.brandSnapshot, i.nameSnapshot].filter(Boolean).join(" ") || i.partId]))

    const result = await prisma.$transaction(async (tx) => {
      const stocks = await tx.inventoryStock.findMany({ where: { partId: { in: [...qtyByPart.keys()] } } })
      const stockByPart = new Map(stocks.map((s) => [s.partId, s]))

      const shortfalls: StockShortfall[] = []
      for (const [partId, qty] of qtyByPart) {
        const have = stockByPart.get(partId)?.quantity ?? 0
        if (have < qty) {
          shortfalls.push({ partId, name: nameByPart.get(partId) ?? partId, have, need: qty, short: qty - have })
        }
      }
      if (shortfalls.length > 0) return { shortfalls, id: null as string | null }

      const delivery = await tx.delivery.create({
        data: {
          deliveryNumber,
          deliverySortNumber: extractTrailingNumber(deliveryNumber),
          companyId,
          customerId: quotation.customerId,
          customerBranchId: quotation.customerBranchId,
          quotationId: quotation.id,
          reference: reference || null,
          deliveryDate: deliveryDateValue,
          createdById: userId,
          items: {
            // Reuse the Quotation's own frozen snapshot fields — same
            // rationale as generateInvoice() carrying a Quotation's snapshot
            // forward rather than re-reading the live SparePart.
            create: stockItems.map((item) => ({
              partId: item.partId,
              description: item.description || [item.brandSnapshot, item.nameSnapshot].filter(Boolean).join(" "),
              quantity: item.quantity,
              stockCategory: item.stockCategory,
              brandSnapshot: item.brandSnapshot,
              nameSnapshot: item.nameSnapshot,
              modelSnapshot: item.modelSnapshot,
              specificationSnapshot: item.specificationSnapshot,
              unitSnapshot: item.unitSnapshot,
            })),
          },
        },
        select: { id: true },
      })

      for (const [partId, qty] of qtyByPart) {
        const have = stockByPart.get(partId)?.quantity ?? 0
        const after = have - qty
        await tx.inventoryStock.update({ where: { partId }, data: { quantity: after } })
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            partId,
            type: "OUT",
            quantity: -qty,
            quantityBefore: have,
            quantityAfter: after,
            referenceType: "DELIVERY",
            reference: `Delivery ${deliveryNumber} (from Quotation ${quotation.quotationNumber})`,
            performedById: userId,
          },
        })
      }

      return { shortfalls: [] as StockShortfall[], id: delivery.id }
    })

    if (result.shortfalls.length > 0) {
      return { error: "Insufficient stock for one or more items", shortfalls: result.shortfalls }
    }
    deliveryId = result.id!

    revalidatePath(`/quotations/${quotationId}`)
    revalidatePath("/delivery")
    revalidatePath("/stock")
  } catch (err) {
    console.error("createDeliveryFromQuotation failed:", err)
    return { error: "Failed to create delivery" }
  }

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.DELIVERY,
    entityId: deliveryId,
    action: AUDIT_ACTIONS.CREATED,
    performedById: userId,
    metadata: { deliveryNumber, source: "FROM_QUOTATION", quotationId },
  })

  redirect(`/delivery/${deliveryId}`)
}

// ─── Edit Delivery ──────────────────────────────────────────────────────────────

/**
 * Edits a Delivery and reconciles inventory to match — per-part NET delta
 * only (new total qty for that part minus its old total qty), never a blind
 * "restore everything then re-deduct everything". This is what makes
 * unrelated items untouched and prevents ever double-deducting/double-
 * restoring the same part. Blocked once the Delivery has been converted to
 * an Invoice (see the module-level rule in DeliveryActions/deleteDelivery).
 */
export async function updateDelivery(id: string, data: DeliveryInput): Promise<{ error: string; shortfalls?: StockShortfall[] } | never> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canEditDelivery(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = DeliverySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { deliveryDate, customerId, customerBranchId, reference, items } = parsed.data

  try {
    const existing = await prisma.delivery.findFirst({
      where: { id, companyId },
      select: { deliveryNumber: true, invoiceId: true, items: { select: { partId: true, quantity: true } } },
    })
    if (!existing) return { error: "Delivery not found" }
    if (existing.invoiceId) {
      return { error: "This delivery has already been converted to an invoice and can no longer be edited" }
    }

    const ownedCustomer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } })
    if (!ownedCustomer) return { error: "Customer not found" }

    let validatedBranchId: string | null = null
    if (customerBranchId) {
      const ownedBranch = await prisma.customerBranch.findFirst({
        where: { id: customerBranchId, customerId, companyId },
        select: { id: true },
      })
      if (!ownedBranch) return { error: "Customer branch not found" }
      validatedBranchId = ownedBranch.id
    }

    const partMap = await loadValidatedParts(companyId, items)
    if (!partMap) return { error: "One or more stock items are invalid" }

    const deliveryDateValue = new Date(`${deliveryDate}T12:00:00`)
    const oldQtyByPart = aggregateQuantitiesByPart(existing.items)
    const newQtyByPart = aggregateQuantitiesByPart(items)
    const allPartIds = new Set([...oldQtyByPart.keys(), ...newQtyByPart.keys()])
    const deltas = [...allPartIds]
      .map((partId) => ({ partId, delta: (newQtyByPart.get(partId) ?? 0) - (oldQtyByPart.get(partId) ?? 0) }))
      .filter((d) => d.delta !== 0)

    const result = await prisma.$transaction(async (tx) => {
      const stocks = await tx.inventoryStock.findMany({ where: { partId: { in: deltas.map((d) => d.partId) } } })
      const stockByPart = new Map(stocks.map((s) => [s.partId, s]))

      // Only a NET deduction (delta > 0) can ever be short — a net
      // restoration (delta < 0) is always safe to apply.
      const shortfalls: StockShortfall[] = []
      for (const d of deltas) {
        if (d.delta <= 0) continue
        const have = stockByPart.get(d.partId)?.quantity ?? 0
        if (have < d.delta) {
          shortfalls.push({ partId: d.partId, name: describePart(d.partId, partMap), have, need: d.delta, short: d.delta - have })
        }
      }
      if (shortfalls.length > 0) return { shortfalls }

      for (const d of deltas) {
        const have = stockByPart.get(d.partId)?.quantity ?? 0
        const after = have - d.delta
        await tx.inventoryStock.upsert({
          where: { partId: d.partId },
          update: { quantity: after },
          create: { partId: d.partId, quantity: after },
        })
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            partId: d.partId,
            type: d.delta > 0 ? "OUT" : "REVERSAL",
            quantity: -d.delta,
            quantityBefore: have,
            quantityAfter: after,
            referenceType: "DELIVERY_EDIT",
            reference: `Delivery ${existing.deliveryNumber} edited`,
            performedById: userId,
          },
        })
      }

      await tx.deliveryItem.deleteMany({ where: { deliveryId: id } })
      await tx.delivery.update({
        where: { id },
        data: {
          customerId,
          customerBranchId: validatedBranchId,
          reference: reference || null,
          deliveryDate: deliveryDateValue,
        },
      })
      await tx.deliveryItem.createMany({
        data: items.map((item) => {
          const part = partMap.get(item.partId)!
          return {
            deliveryId: id,
            partId: item.partId,
            description: [part.brand, part.name].filter(Boolean).join(" "),
            quantity: item.quantity,
            stockCategory: getStockType(part.category),
            brandSnapshot: part.brand,
            nameSnapshot: part.name,
            modelSnapshot: part.model,
            specificationSnapshot: part.specification,
            unitSnapshot: part.unit,
          }
        }),
      })

      return { shortfalls: [] as StockShortfall[] }
    })

    if (result.shortfalls.length > 0) {
      return { error: "Insufficient stock for one or more items", shortfalls: result.shortfalls }
    }

    revalidatePath(`/delivery/${id}`)
    revalidatePath("/delivery")
    revalidatePath("/stock")
  } catch (err) {
    console.error("updateDelivery failed:", err)
    return { error: "Failed to update delivery" }
  }

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.DELIVERY,
    entityId: id,
    action: AUDIT_ACTIONS.UPDATED,
    performedById: userId,
    metadata: { itemCount: items.length },
  })

  redirect(`/delivery/${id}`)
}

// ─── Delete Delivery ────────────────────────────────────────────────────────────

/**
 * Deletes a Delivery and restores every quantity it deducted, in a single
 * transaction.
 *
 * Restriction rule: a Delivery that has already been converted to an Invoice
 * (invoiceId set) CANNOT be deleted — mirrors deleteQuotation's own rule for
 * an Invoice already generated from a Quotation ("the invoice's provenance is
 * a business record, not something to quietly orphan"). The Invoice already
 * carries its own frozen copy of the delivered items/quantities forward at
 * generation time, so deleting the source Delivery afterwards would silently
 * break that traceability without touching the Invoice's own data — the
 * Invoice must be handled first (there is currently no "unlink" flow, same
 * as Invoice/Sales Ledger).
 */
export async function deleteDelivery(id: string): Promise<{ error: string } | { success: true }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canDeleteDelivery(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const delivery = await prisma.delivery.findFirst({
    where: { id, companyId },
    select: { deliveryNumber: true, invoiceId: true, items: { select: { partId: true, quantity: true } } },
  })
  if (!delivery) return { error: "Delivery not found" }
  if (delivery.invoiceId) {
    return { error: "This delivery is linked to an invoice and cannot be deleted" }
  }

  try {
    const qtyByPart = aggregateQuantitiesByPart(delivery.items)

    await prisma.$transaction(async (tx) => {
      const stocks = await tx.inventoryStock.findMany({ where: { partId: { in: [...qtyByPart.keys()] } } })
      const stockByPart = new Map(stocks.map((s) => [s.partId, s]))

      for (const [partId, qty] of qtyByPart) {
        const have = stockByPart.get(partId)?.quantity ?? 0
        const after = have + qty
        await tx.inventoryStock.upsert({
          where: { partId },
          update: { quantity: after },
          create: { partId, quantity: after },
        })
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            partId,
            type: "REVERSAL",
            quantity: qty,
            quantityBefore: have,
            quantityAfter: after,
            referenceType: "DELIVERY_DELETE",
            reference: `Delivery ${delivery.deliveryNumber} deleted`,
            performedById: userId,
          },
        })
      }

      await tx.deliveryDocument.deleteMany({ where: { deliveryId: id } })
      await tx.deliveryItem.deleteMany({ where: { deliveryId: id } })
      await tx.delivery.delete({ where: { id } })
    })

    revalidatePath("/delivery")
    revalidatePath("/stock")

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.DELIVERY,
      entityId: id,
      action: AUDIT_ACTIONS.DELETED,
      performedById: userId,
      metadata: { deliveryNumber: delivery.deliveryNumber },
    })

    return { success: true as const }
  } catch (err) {
    console.error(`deleteDelivery ${id} failed:`, err)
    return { error: "Failed to delete delivery" }
  }
}

// ─── Delivery -> Invoice ────────────────────────────────────────────────────────

/**
 * Converts a Delivery into an Invoice. Reuses DirectInvoiceSchema/the normal
 * Invoice creation form exactly — a Delivery Note carries no selling price,
 * so pricing is always typed in by the user at this step, same as every
 * other Invoice creation path in this system (Quotation/Direct Invoice items
 * never auto-fill price from Stock's sellingPrice either — see
 * QuotationForm's addStockItem comment). Inventory-neutral: this never
 * touches InventoryStock (the Delivery already moved it).
 */
export async function createInvoiceFromDelivery(
  deliveryId: string,
  data: DirectInvoiceInput
): Promise<{ error: string } | never> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canConvertDeliveryToInvoice(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = DirectInvoiceSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { customerId, customerPin, date, vatPercent, remarks, items } = parsed.data
  const invoiceNumber = normalizeBusinessNumber(parsed.data.invoiceNumber)

  let invoiceId: string
  try {
    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId, companyId },
      select: { id: true, invoiceId: true, deliveryNumber: true },
    })
    if (!delivery) return { error: "Delivery not found" }
    if (delivery.invoiceId) return { error: "This delivery already has an invoice" }

    const existingNumber = await prisma.invoice.findUnique({ where: { invoiceNumber } })
    if (existingNumber) return { error: "INVOICE_NUMBER_EXISTS" }

    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } })
    if (!customer) return { error: "Customer not found" }

    const partMap = await loadValidatedParts(companyId, items)
    if (!partMap) return { error: "One or more stock items are invalid" }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const vatAmount = (subtotal * vatPercent) / 100
    const totalAmount = subtotal + vatAmount
    const invoiceDate = new Date(`${date}T12:00:00`)

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceSortNumber: extractTrailingNumber(invoiceNumber),
          source: "FROM_DELIVERY",
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

      await tx.delivery.update({ where: { id: deliveryId }, data: { invoiceId: invoice.id } })

      return { invoiceId: invoice.id }
    })

    invoiceId = result.invoiceId

    revalidatePath(`/delivery/${deliveryId}`)
    revalidatePath("/delivery")
    revalidatePath("/quotations/invoices")
  } catch (err) {
    console.error("createInvoiceFromDelivery failed:", err)
    return { error: "Failed to generate invoice" }
  }

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.INVOICE,
    entityId: invoiceId,
    action: AUDIT_ACTIONS.CREATED,
    performedById: userId,
    metadata: { invoiceNumber, source: "FROM_DELIVERY", deliveryId },
  })
  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.DELIVERY,
    entityId: deliveryId,
    action: AUDIT_ACTIONS.UPDATED,
    performedById: userId,
    metadata: { linkedInvoiceId: invoiceId, invoiceNumber },
  })

  redirect(`/quotations/invoices/${invoiceId}`)
}

// ─── Manual Dropbox sync ────────────────────────────────────────────────────────

/**
 * Manual "Sync to Dropbox" — the ONLY thing that ever uploads a Delivery
 * Note. Creating/editing a Delivery never triggers this automatically. Always
 * re-targets the delivery's current file (no versioning — see the
 * DeliveryDocument schema comment), so retrying is idempotent.
 */
export async function resyncDeliveryDropbox(
  id: string
): Promise<{ error: string } | { success: true; synced: ("PDF" | "XLSX")[] }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canSyncDelivery(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const existing = await prisma.delivery.findFirst({ where: { id, companyId }, select: { id: true, deliveryNumber: true } })
  if (!existing) return { error: "Delivery not found" }

  const result = await syncDeliveryToDropbox(id, companyId)
  if (result.errors.length > 0) {
    console.error(`Delivery ${id} manual Dropbox sync had errors:`, result.errors)
  }

  if (result.skippedReason) return { error: result.skippedReason }
  if (result.synced.length === 0) return { error: result.errors[0] ?? "Failed to sync to Dropbox" }

  revalidatePath(`/delivery/${id}`)

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.DELIVERY,
    entityId: id,
    action: AUDIT_ACTIONS.DROPBOX_RESYNCED,
    performedById: userId,
    metadata: { deliveryNumber: existing.deliveryNumber, synced: result.synced },
  })

  return { success: true as const, synced: result.synced }
}
