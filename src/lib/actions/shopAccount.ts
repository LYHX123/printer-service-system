"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ShopAccountEntrySchema } from "@/lib/schemas"
import { canCreateLedgerEntryPerm, canEditLedgerEntryPerm, canDeleteLedgerEntryPerm } from "@/lib/permissions"
import { findOrCreateShopAccountCategory } from "@/lib/data/shopAccount"
import { deleteShopAccountAttachment as deleteAttachmentFile } from "@/lib/uploads"
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import type { ShopAccountEntryInput } from "@/lib/schemas"
import type { Role } from "@/types"

const NEW_CATEGORY_VALUE = "__new__"

export async function createShopAccountEntry(
  data: ShopAccountEntryInput
): Promise<{ error: string } | { success: true; id: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "shop")) {
    return { error: "Forbidden" }
  }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = ShopAccountEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { date, type, categoryId, newCategoryName, description, payee, amount, paymentMethod, remarks } = parsed.data

  try {
    // categoryId is client-supplied — when picking an EXISTING category (not the
    // "__new__" workflow, which already scopes by companyId via
    // findOrCreateShopAccountCategory), verify it belongs to this authenticated
    // company before it's ever persisted. companyId comes only from the session,
    // never from the request. Generic "not found" whether the id is missing,
    // malformed, or real-but-belongs-to-another-company — never distinguishable.
    if (categoryId !== NEW_CATEGORY_VALUE) {
      const ownedCategory = await prisma.shopAccountCategory.findFirst({ where: { id: categoryId, companyId }, select: { id: true } })
      if (!ownedCategory) return { error: "Category not found" }
    }

    const finalCategoryId =
      categoryId === NEW_CATEGORY_VALUE
        ? (await findOrCreateShopAccountCategory(companyId, type, newCategoryName!)).id
        : categoryId

    const created = await prisma.shopAccountEntry.create({
      data: {
        companyId,
        date: new Date(`${date}T12:00:00`),
        type,
        categoryId: finalCategoryId,
        description,
        payee: payee || null,
        amount,
        paymentMethod,
        remarks: remarks || null,
        createdById: userId,
      },
      select: { id: true },
    })

    revalidatePath("/ledger/shop")

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.SHOP_ACCOUNT_ENTRY,
      entityId: created.id,
      action: AUDIT_ACTIONS.CREATED,
      performedById: userId,
      metadata: { type, description, amount },
    })

    return { success: true as const, id: created.id }
  } catch {
    return { error: "Failed to save record" }
  }
}

export async function updateShopAccountEntry(id: string, data: ShopAccountEntryInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canEditLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "shop")) {
    return { error: "Forbidden" }
  }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = ShopAccountEntrySchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { date, type, categoryId, newCategoryName, description, payee, amount, paymentMethod, remarks } = parsed.data

  try {
    const existing = await prisma.shopAccountEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    // Same ownership validation as createShopAccountEntry — see its comment.
    if (categoryId !== NEW_CATEGORY_VALUE) {
      const ownedCategory = await prisma.shopAccountCategory.findFirst({ where: { id: categoryId, companyId }, select: { id: true } })
      if (!ownedCategory) return { error: "Category not found" }
    }

    const finalCategoryId =
      categoryId === NEW_CATEGORY_VALUE
        ? (await findOrCreateShopAccountCategory(companyId, type, newCategoryName!)).id
        : categoryId

    await prisma.shopAccountEntry.update({
      where: { id },
      data: {
        date: new Date(`${date}T12:00:00`),
        type,
        categoryId: finalCategoryId,
        description,
        payee: payee || null,
        amount,
        paymentMethod,
        remarks: remarks || null,
      },
    })

    revalidatePath("/ledger/shop")

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.SHOP_ACCOUNT_ENTRY,
      entityId: id,
      action: AUDIT_ACTIONS.UPDATED,
      performedById: userId,
      metadata: { type, description, amount },
    })

    return { success: true as const }
  } catch {
    return { error: "Failed to update record" }
  }
}

export async function deleteShopAccountEntry(id: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canDeleteLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "shop")) {
    return { error: "Forbidden" }
  }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    const existing = await prisma.shopAccountEntry.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Record not found" }

    if (existing.attachmentUrl) {
      await deleteAttachmentFile(existing.attachmentUrl)
    }

    await prisma.shopAccountEntry.delete({ where: { id } })
    revalidatePath("/ledger/shop")

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.SHOP_ACCOUNT_ENTRY,
      entityId: id,
      action: AUDIT_ACTIONS.DELETED,
      performedById: userId,
      metadata: { type: existing.type, description: existing.description, amount: Number(existing.amount) },
    })

    return { success: true as const }
  } catch {
    return { error: "Failed to delete record" }
  }
}
