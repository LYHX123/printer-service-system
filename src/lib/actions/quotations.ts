"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canCreateQuotation } from "@/lib/permissions"
import { QuotationSchema, QuotationStatusSchema } from "@/lib/schemas"
import { extractTrailingNumber, normalizeBusinessNumber } from "@/lib/numbering"
import { getStockType } from "@/lib/stock-types"
import { logActivity } from "@/lib/audit"
import { saveQuotationItemPictureSnapshot } from "@/lib/uploads"
import { QUOTATION_STATUS_TRANSITIONS } from "@/types"
import type { QuotationInput, QuotationStatusInput } from "@/lib/schemas"
import type { Role, PartCategory } from "@/types"

function computeTotal(subtotal: number, vatPercent: number): number {
  const vatAmount = (subtotal * vatPercent) / 100
  return subtotal + vatAmount
}

type QuotationPart = {
  id: string
  name: string
  brand: string | null
  model: string | null
  specification: string | null
  category: PartCategory
  unit: string | null
  imageUrl: string | null
}

/**
 * Copies each freshly-saved QuotationItem's linked SparePart picture into its
 * own immutable snapshot file (see saveQuotationItemPictureSnapshot), so the
 * Quotation Excel export never retroactively changes if the SparePart's
 * picture is replaced later. Runs after the quotation row itself is
 * committed — file I/O has no place inside a DB transaction — and is
 * best-effort: a failed copy just leaves pictureSnapshot unset, and the
 * Excel generator's fallback chain (snapshot -> live SparePart -> blank)
 * covers it from there.
 */
async function snapshotQuotationItemPictures(
  quotationId: string,
  partMap: Map<string, QuotationPart>
): Promise<void> {
  const savedItems = await prisma.quotationItem.findMany({
    where: { quotationId },
    select: { id: true, partId: true },
  })

  await Promise.all(
    savedItems.map(async (item) => {
      if (!item.partId) return
      const part = partMap.get(item.partId)
      if (!part?.imageUrl) return

      try {
        const snapshotUrl = await saveQuotationItemPictureSnapshot(item.id, part.imageUrl)
        if (snapshotUrl) {
          await prisma.quotationItem.update({
            where: { id: item.id },
            data: { pictureSnapshot: snapshotUrl },
          })
        }
      } catch (err) {
        console.error(`Failed to snapshot picture for quotation item ${item.id}:`, err)
      }
    })
  )
}

export async function createQuotation(data: QuotationInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateQuotation(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = QuotationSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    customerId,
    customerBranchId,
    contactName,
    contactPhone,
    contactEmail,
    contactAddress,
    validUntil,
    vatPercent,
    remarks,
    internalNotes,
    items,
  } = parsed.data
  const quotationNumber = normalizeBusinessNumber(parsed.data.quotationNumber)

  let quotation: { id: string }
  let partMap: Map<string, QuotationPart>
  try {
    const existingNumber = await prisma.quotation.findUnique({ where: { quotationNumber } })
    if (existingNumber) return { error: "QUOTATION_NUMBER_EXISTS" }

    const parts = await prisma.sparePart.findMany({
      where: { id: { in: items.map((i) => i.partId) }, companyId },
      select: { id: true, name: true, brand: true, model: true, specification: true, category: true, unit: true, imageUrl: true },
    })
    partMap = new Map(parts.map((p) => [p.id, p]))
    if (parts.length !== new Set(items.map((i) => i.partId)).size) {
      return { error: "One or more stock items are invalid" }
    }

    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )
    const totalCost = computeTotal(subtotal, vatPercent)

    quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        quotationSortNumber: extractTrailingNumber(quotationNumber),
        companyId,
        customerId,
        customerBranchId: customerBranchId || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        contactAddress: contactAddress || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        subtotal,
        vatPercent,
        totalCost,
        remarks: remarks || null,
        internalNotes: internalNotes || null,
        createdById: userId,
        items: {
          create: items.map((item) => {
            const part = partMap.get(item.partId)!
            return {
              partId: item.partId,
              description: [part.brand, part.name].filter(Boolean).join(" "),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.quantity * item.unitPrice,
              // Frozen snapshot — later edits to the SparePart record must never
              // change the wording of a quotation that already quoted it.
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

    revalidatePath("/quotations")
  } catch (err) {
    console.error("createQuotation failed:", err)
    return { error: "Failed to create quotation" }
  }

  // Picture snapshotting is best-effort and must never undo a Quotation that
  // already committed successfully — a missing/unreadable image, a disk
  // error, anything, just leaves pictureSnapshot unset for that item (the
  // Excel generator falls back to the live SparePart picture from there).
  try {
    await snapshotQuotationItemPictures(quotation.id, partMap)
  } catch (err) {
    console.error(`Failed to snapshot pictures for quotation ${quotation.id}:`, err)
  }

  redirect(`/quotations/${quotation.id}`)
}

export async function updateQuotation(id: string, data: QuotationInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateQuotation(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = QuotationSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    customerId,
    customerBranchId,
    contactName,
    contactPhone,
    contactEmail,
    contactAddress,
    validUntil,
    vatPercent,
    remarks,
    internalNotes,
    items,
  } = parsed.data
  const quotationNumber = normalizeBusinessNumber(parsed.data.quotationNumber)

  let existing: { status: string; customerId: string; customerBranchId: string | null }
  let partMap: Map<string, QuotationPart>
  let newCustomerBranchId: string | null
  try {
    const found = await prisma.quotation.findFirst({
      where: { id, companyId },
      select: { status: true, customerId: true, customerBranchId: true },
    })
    if (!found) return { error: "Quotation not found" }
    if (found.status !== "DRAFT" && found.status !== "SENT") {
      return { error: "Only draft or sent quotations can be edited" }
    }
    existing = found

    const existingNumber = await prisma.quotation.findFirst({
      where: { quotationNumber, companyId, NOT: { id } },
      select: { id: true },
    })
    if (existingNumber) return { error: "QUOTATION_NUMBER_EXISTS" }

    const parts = await prisma.sparePart.findMany({
      where: { id: { in: items.map((i) => i.partId) }, companyId },
      select: { id: true, name: true, brand: true, model: true, specification: true, category: true, unit: true, imageUrl: true },
    })
    partMap = new Map(parts.map((p) => [p.id, p]))
    if (parts.length !== new Set(items.map((i) => i.partId)).size) {
      return { error: "One or more stock items are invalid" }
    }

    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )
    const totalCost = computeTotal(subtotal, vatPercent)
    newCustomerBranchId = customerBranchId || null

    await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } })
      await tx.quotation.update({
        where: { id },
        data: {
          quotationNumber,
          quotationSortNumber: extractTrailingNumber(quotationNumber),
          customerId,
          customerBranchId: newCustomerBranchId,
          contactName: contactName || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          contactAddress: contactAddress || null,
          validUntil: validUntil ? new Date(validUntil) : null,
          subtotal,
          vatPercent,
          totalCost,
          remarks: remarks || null,
          internalNotes: internalNotes || null,
        },
      })
      if (items.length > 0) {
        await tx.quotationItem.createMany({
          data: items.map((item) => {
            const part = partMap.get(item.partId)!
            return {
              quotationId: id,
              partId: item.partId,
              description: [part.brand, part.name].filter(Boolean).join(" "),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.quantity * item.unitPrice,
              stockCategory: getStockType(part.category),
              brandSnapshot: part.brand,
              nameSnapshot: part.name,
              modelSnapshot: part.model,
              specificationSnapshot: part.specification,
              unitSnapshot: part.unit,
            }
          }),
        })
      }
    })

    if (existing.customerId !== customerId) {
      await logActivity({
        companyId,
        entityType: "Quotation",
        entityId: id,
        action: "CUSTOMER_CHANGED",
        performedById: session.user.id as string,
        metadata: { from: existing.customerId, to: customerId },
      })
    } else if (existing.customerBranchId !== newCustomerBranchId) {
      await logActivity({
        companyId,
        entityType: "Quotation",
        entityId: id,
        action: "PROJECT_CHANGED",
        performedById: session.user.id as string,
        metadata: { from: existing.customerBranchId, to: newCustomerBranchId },
      })
    }

    revalidatePath(`/quotations/${id}`)
    revalidatePath("/quotations")
  } catch (err) {
    console.error("updateQuotation failed:", err)
    return { error: "Failed to update quotation" }
  }

  // Best-effort — must never undo an update that already committed. See the
  // matching comment in createQuotation.
  try {
    await snapshotQuotationItemPictures(id, partMap)
  } catch (err) {
    console.error(`Failed to snapshot pictures for quotation ${id}:`, err)
  }

  redirect(`/quotations/${id}`)
}

export async function updateQuotationStatus(id: string, data: QuotationStatusInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  const parsed = QuotationStatusSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid data" }

  try {
    const existing = await prisma.quotation.findFirst({
      where: { id, companyId },
      select: { status: true },
    })
    if (!existing) return { error: "Quotation not found" }

    const allowed = QUOTATION_STATUS_TRANSITIONS[existing.status]
    if (!allowed.includes(parsed.data.toStatus)) {
      return { error: `Cannot transition from ${existing.status} to ${parsed.data.toStatus}` }
    }

    await prisma.quotation.update({
      where: { id },
      data: {
        status: parsed.data.toStatus,
        ...(parsed.data.toStatus === "APPROVED" ? { approvedAt: new Date() } : {}),
      },
    })

    revalidatePath(`/quotations/${id}`)
    revalidatePath("/quotations")
    return { success: true }
  } catch {
    return { error: "Failed to update status" }
  }
}
