"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canCreateQuotation, canEditQuotationPerm, canApproveQuotation, canExportQuotation, canDeleteQuotationPerm } from "@/lib/permissions"
import { QuotationSchema, QuotationStatusSchema } from "@/lib/schemas"
import { extractTrailingNumber, normalizeBusinessNumber } from "@/lib/numbering"
import { getStockType } from "@/lib/stock-types"
import { logActivity } from "@/lib/audit"
import { saveQuotationItemPictureSnapshot } from "@/lib/uploads"
import { syncQuotationVersionToDropbox, syncQuotationFinalToDropbox } from "@/lib/quotationExcel/dropboxSync"
import { createQuotationVersionSnapshot } from "@/lib/quotationExcel/versionSnapshot"
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
    // customerId/customerBranchId are client-supplied — verify both belong to
    // this authenticated company (and the branch to this exact customer)
    // before they're ever persisted. companyId here comes only from the
    // session, never from the request. Same generic "not found" whether the
    // id is missing, malformed, or real-but-belongs-to-another-company —
    // never distinguishable, so a response can't confirm another company's
    // customer/branch exists.
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
        customerBranchId: validatedBranchId,
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

  // Immutable V1 business-data snapshot — best-effort, same rule as above.
  // Must run before the Dropbox sync below so the V1 files and the V1
  // Historical View are both derived from the same frozen picture snapshots.
  try {
    await createQuotationVersionSnapshot(quotation.id, companyId, 1, userId)
  } catch (err) {
    console.error(`Failed to create V1 snapshot for quotation ${quotation.id}:`, err)
  }

  await logActivity({
    companyId,
    entityType: "Quotation",
    entityId: quotation.id,
    action: "CREATED",
    performedById: userId,
    metadata: { quotationNumber, itemCount: items.length },
  })

  // Best-effort V1 Dropbox sync — the Quotation record above is already safely
  // committed regardless of what happens here (no Short Name yet, Dropbox
  // down, generation failure, ...). Never blocks/undoes quotation creation;
  // see syncQuotationVersionToDropbox for the retry story (the Detail page's
  // "Sync to Dropbox" action calls the same function).
  try {
    const result = await syncQuotationVersionToDropbox(quotation.id, companyId, 1)
    if (result.errors.length > 0) {
      console.error(`Quotation ${quotation.id} Dropbox sync had errors:`, result.errors)
    }
  } catch (err) {
    console.error(`Quotation ${quotation.id} Dropbox sync failed:`, err)
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
  let newVersion = 0
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

    // Same ownership validation as createQuotation — see its comment.
    const ownedCustomer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } })
    if (!ownedCustomer) return { error: "Customer not found" }

    if (customerBranchId) {
      const ownedBranch = await prisma.customerBranch.findFirst({
        where: { id: customerBranchId, customerId, companyId },
        select: { id: true },
      })
      if (!ownedBranch) return { error: "Customer branch not found" }
      newCustomerBranchId = ownedBranch.id
    } else {
      newCustomerBranchId = null
    }

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

    await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } })
      // Every Adjust save advances the Dropbox document version by exactly
      // one, atomically with the business-data change — see the
      // Quotation.currentVersion schema comment. This is what "Adjust
      // Quotation" means: unlike the old plain Edit, a save here always
      // produces a new archived version, never silently overwrites V(n-1).
      const updated = await tx.quotation.update({
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
          currentVersion: { increment: 1 },
        },
        select: { currentVersion: true },
      })
      newVersion = updated.currentVersion
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

    await logActivity({
      companyId,
      entityType: "Quotation",
      entityId: id,
      action: "ADJUSTED",
      performedById: session.user.id as string,
      metadata: { quotationNumber, fromVersion: newVersion - 1, toVersion: newVersion },
    })

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

  // Immutable snapshot for the version just created — must run before the
  // Dropbox sync below, same reasoning as createQuotation. V1's snapshot
  // (and any earlier version's) is never touched here — createQuotationVersionSnapshot
  // only ever writes the row for `newVersion`, a version number nothing has used before.
  try {
    await createQuotationVersionSnapshot(id, companyId, newVersion, session.user.id as string)
  } catch (err) {
    console.error(`Failed to create v${newVersion} snapshot for quotation ${id}:`, err)
  }

  // Best-effort Dropbox sync for the new version — same "never blocks/undoes
  // the save" rule as createQuotation. Always targets the version number
  // that was just incremented above, so a later manual retry (see
  // resyncQuotationDropbox) re-syncs that exact version rather than
  // computing a new one.
  try {
    const result = await syncQuotationVersionToDropbox(id, companyId, newVersion)
    if (result.errors.length > 0) {
      console.error(`Quotation ${id} v${newVersion} Dropbox sync had errors:`, result.errors)
    }
  } catch (err) {
    console.error(`Quotation ${id} v${newVersion} Dropbox sync failed:`, err)
  }

  redirect(`/quotations/${id}`)
}

export async function updateQuotationStatus(id: string, data: QuotationStatusInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = session.user.modulePermissions
  const companyId = session.user.companyId as string

  const parsed = QuotationStatusSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid data" }

  // Approve/Reject is a distinct, server-enforced authority — quotations.edit
  // (or even quotations.view) must never be enough to approve/reject one's own
  // or anyone else's quotation. Other transitions (e.g. DRAFT -> SENT) fall
  // back to the regular edit permission.
  const isApprovalDecision = parsed.data.toStatus === "APPROVED" || parsed.data.toStatus === "REJECTED"
  const authorized = isApprovalDecision
    ? canApproveQuotation(role, permissions)
    : canEditQuotationPerm(role, permissions)
  if (!authorized) return { error: "Forbidden" }

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

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        status: parsed.data.toStatus,
        ...(parsed.data.toStatus === "APPROVED" ? { approvedAt: new Date() } : {}),
      },
      select: { currentVersion: true },
    })

    revalidatePath(`/quotations/${id}`)
    revalidatePath("/quotations")

    // Approve-time FINAL snapshot — best-effort, same "never blocks/undoes
    // the status change" rule as everywhere else. Built from the quotation's
    // current version (currentVersion), never re-reading an older one.
    let finalGenerated = false
    if (parsed.data.toStatus === "APPROVED") {
      try {
        const result = await syncQuotationFinalToDropbox(id, companyId, updated.currentVersion)
        finalGenerated = result.synced.length > 0
        if (result.errors.length > 0) {
          console.error(`Quotation ${id} FINAL Dropbox sync had errors:`, result.errors)
        }
      } catch (err) {
        console.error(`Quotation ${id} FINAL Dropbox sync failed:`, err)
      }
    }

    await logActivity({
      companyId,
      entityType: "Quotation",
      entityId: id,
      action: parsed.data.toStatus === "APPROVED" ? "APPROVED" : "STATUS_CHANGED",
      performedById: session.user.id as string,
      metadata:
        parsed.data.toStatus === "APPROVED"
          ? { approvedFromVersion: updated.currentVersion, finalGenerated }
          : { from: existing.status, to: parsed.data.toStatus },
    })

    return { success: true }
  } catch {
    return { error: "Failed to update status" }
  }
}

/**
 * Manual retry for the best-effort sync that createQuotation/updateQuotation/
 * updateQuotationStatus already attempt automatically — for when that
 * attempt was skipped (Customer had no Short Name yet) or failed (Dropbox
 * was briefly unreachable, PDF conversion failed, ...).
 *
 * With no `targetVersion`, re-targets the quotation's *current* state —
 * Quotation.currentVersion (or the FINAL snapshot, if the quotation is
 * already Approved). Pass an explicit `targetVersion` to instead retry one
 * specific historical version (e.g. a V1 whose PDF never synced because
 * LibreOffice wasn't installed yet at the time) — the UI doesn't expose this
 * per-version retry yet, but the capability exists here for that case. Either
 * way this never increments anything itself, so a retry can never advance to
 * the next version by accident: the underlying sync upserts the same
 * (quotationId, fileType, version, isFinal) row every time.
 */
export async function resyncQuotationDropbox(
  id: string,
  targetVersion?: number
): Promise<{ error: string } | { success: true; synced: ("PDF" | "XLSX")[] }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canExportQuotation(role, permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const existing = await prisma.quotation.findFirst({
    where: { id, companyId },
    select: { status: true, currentVersion: true, quotationNumber: true },
  })
  if (!existing) return { error: "Quotation not found" }

  const result =
    typeof targetVersion === "number"
      ? await syncQuotationVersionToDropbox(id, companyId, targetVersion)
      : existing.status === "APPROVED"
        ? await syncQuotationFinalToDropbox(id, companyId, existing.currentVersion)
        : await syncQuotationVersionToDropbox(id, companyId, existing.currentVersion)

  if (result.errors.length > 0) {
    // syncOneFile/generateExcelBufferSafe already console.error the raw
    // exception at the point it happened; this one line ties the whole
    // manual-retry attempt together for whoever's reading server logs.
    console.error(`Quotation ${id} manual Dropbox retry had errors:`, result.errors)
  }

  if (result.skippedReason) return { error: result.skippedReason }
  if (result.synced.length === 0) return { error: result.errors[0] ?? "Failed to sync to Dropbox" }

  revalidatePath(`/quotations/${id}`)

  await logActivity({
    companyId,
    entityType: "Quotation",
    entityId: id,
    action: "DROPBOX_RESYNCED",
    performedById: userId,
    metadata: { quotationNumber: existing.quotationNumber, synced: result.synced },
  })

  return { success: true as const, synced: result.synced }
}

/**
 * Deletes a Quotation and its own database records only — QuotationItem,
 * QuotationVersion (business-data snapshots), and QuotationDocument
 * (Dropbox sync records). Never touches the actual files in Dropbox: V1,
 * V2, FINAL etc. are business archives and stay exactly where they are,
 * under Quotation/{ShortName}, for as long as that customer's Dropbox
 * folder exists — this only ever removes this app's own database rows.
 *
 * Blocked outright if an Invoice already exists for this quotation (DB has
 * Invoice.quotationId ON DELETE SET NULL, which would let the delete
 * through and just silently disconnect the invoice — deliberately not what
 * happens here; the invoice's provenance is a business record, not
 * something to quietly orphan). ServiceJob.quotationId and
 * CommunicationLog.quotationId are both ON DELETE SET NULL and need no
 * explicit handling — Postgres does that automatically.
 */
export async function deleteQuotation(id: string): Promise<{ error: string } | { success: true }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canDeleteQuotationPerm(role, permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const quotation = await prisma.quotation.findFirst({
    where: { id, companyId },
    select: { id: true, quotationNumber: true, invoice: { select: { id: true } } },
  })
  if (!quotation) return { error: "Quotation not found" }
  if (quotation.invoice) {
    return { error: "This quotation cannot be deleted because an invoice has already been generated." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // RESTRICT foreign keys — must go first, in this order, or the final
      // quotation.delete() would fail with a constraint violation.
      await tx.quotationDocument.deleteMany({ where: { quotationId: id } })
      await tx.quotationVersion.deleteMany({ where: { quotationId: id } })
      await tx.quotationItem.deleteMany({ where: { quotationId: id } })
      await tx.quotation.delete({ where: { id } })
    })

    await logActivity({
      companyId,
      entityType: "Quotation",
      entityId: id,
      action: "DELETED",
      performedById: session.user.id as string,
      metadata: { quotationNumber: quotation.quotationNumber },
    })

    revalidatePath("/quotations")
    return { success: true as const }
  } catch (err) {
    console.error(`deleteQuotation ${id} failed:`, err)
    return { error: "Failed to delete quotation" }
  }
}
