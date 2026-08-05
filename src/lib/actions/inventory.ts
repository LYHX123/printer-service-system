"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SparePartSchema, StockMovementSchema } from "@/lib/schemas"
import { generatePartNumber } from "@/lib/utils"
import { canCreateStock, canEditStock, canDeleteStock, canAdjustStock } from "@/lib/permissions"
import { getStockType, categoryToBucket } from "@/lib/stock-types"
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import type { SparePartInput, StockMovementInput } from "@/lib/schemas"
import type { Role } from "@/types"

export async function createSparePart(
  data: SparePartInput
): Promise<{ error: string } | { success: true; id: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = SparePartSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    name, model, specification, description, category, brand, supplier, compatibleWith,
    unit, unitCost, sellingPrice, reorderLevel, location, quantity,
  } = parsed.data

  // Bucket-specific: stock.equipment.view alone must never grant create rights
  // on Consumption/Parts — the bucket is resolved from the validated category,
  // not trusted verbatim from the client.
  if (!canCreateStock(session.user.role as Role, session.user.modulePermissions, categoryToBucket(category))) {
    return { error: "Forbidden" }
  }

  let part: { id: string }
  try {
    // partNumber is always server-generated now — never taken from the form.
    let finalPartNumber = generatePartNumber((await prisma.sparePart.count({ where: { companyId } })) + 1)
    // Extremely unlikely collision guard (e.g. concurrent creates) — bump until unique.
    for (let attempt = 0; await prisma.sparePart.findFirst({ where: { partNumber: finalPartNumber, companyId } }); attempt++) {
      finalPartNumber = generatePartNumber((await prisma.sparePart.count({ where: { companyId } })) + 1 + attempt + 1)
    }

    part = await prisma.$transaction(async (tx) => {
      const created = await tx.sparePart.create({
        data: {
          companyId,
          partNumber: finalPartNumber,
          name,
          model: model || null,
          specification: specification || null,
          description: description || null,
          category,
          brand: brand || null,
          supplier: supplier || null,
          compatibleWith: compatibleWith || null,
          unit: unit || null,
          unitCost,
          sellingPrice,
          reorderLevel,
        },
        select: { id: true },
      })

      await tx.inventoryStock.create({
        data: {
          partId: created.id,
          quantity,
          location: location || null,
          lastCounted: quantity > 0 ? new Date() : null,
        },
      })

      if (quantity > 0) {
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            partId: created.id,
            type: "IN",
            quantity,
            quantityBefore: 0,
            quantityAfter: quantity,
            referenceType: "MANUAL",
            unitPrice: unitCost,
            reference: "Initial stock",
            performedById: userId,
          },
        })
      }

      return created
    })

    revalidatePath("/stock")
  } catch {
    return { error: "Failed to create spare part" }
  }

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.STOCK,
    entityId: part.id,
    action: AUDIT_ACTIONS.CREATED,
    performedById: userId,
    metadata: { name, category, quantity },
  })

  return { success: true as const, id: part.id }
}

export async function updateSparePart(id: string, data: SparePartInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = session.user.modulePermissions
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = SparePartSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    name, model, specification, description, category, brand, supplier, compatibleWith,
    unit, unitCost, sellingPrice, reorderLevel, location, quantity,
  } = parsed.data

  try {
    const existing = await prisma.sparePart.findFirst({ where: { id, companyId }, include: { stock: true } })
    if (!existing) return { error: "Part not found" }

    // Bucket-specific: must be allowed to edit the item's current bucket, and
    // (if the form is also moving it to a different bucket) the target bucket too.
    if (!canEditStock(role, permissions, categoryToBucket(existing.category))) return { error: "Forbidden" }
    if (category !== existing.category && !canEditStock(role, permissions, categoryToBucket(category))) {
      return { error: "Forbidden" }
    }

    const currentQuantity = existing.stock?.quantity ?? 0
    const quantityDelta = quantity - currentQuantity

    await prisma.$transaction(async (tx) => {
      await tx.sparePart.update({
        where: { id },
        data: {
          // partNumber is intentionally left untouched — it's server-generated
          // once at creation and never re-derived from form input.
          name,
          model: model || null,
          specification: specification || null,
          description: description || null,
          category,
          brand: brand || null,
          supplier: supplier || null,
          compatibleWith: compatibleWith || null,
          unit: unit || null,
          unitCost,
          sellingPrice,
          reorderLevel,
        },
      })

      await tx.inventoryStock.upsert({
        where: { partId: id },
        update: { quantity, location: location || null },
        create: { partId: id, quantity, location: location || null },
      })

      if (quantityDelta !== 0) {
        await tx.inventoryTransaction.create({
          data: {
            companyId,
            partId: id,
            type: "ADJUSTMENT",
            quantity: quantityDelta,
            quantityBefore: currentQuantity,
            quantityAfter: quantity,
            referenceType: "MANUAL",
            reference: "Quantity updated",
            performedById: userId,
          },
        })
      }
    })

    revalidatePath(`/stock/${id}/edit`)
    revalidatePath("/stock")
  } catch {
    return { error: "Failed to update spare part" }
  }

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.STOCK,
    entityId: id,
    action: AUDIT_ACTIONS.UPDATED,
    performedById: userId,
    metadata: { name, category, quantity },
  })

  redirect(`/stock?type=${getStockType(category)}`)
}

export async function setSparePartActive(id: string, isActive: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    const existing = await prisma.sparePart.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Part not found" }

    if (!canDeleteStock(session.user.role as Role, session.user.modulePermissions, categoryToBucket(existing.category))) {
      return { error: "Forbidden" }
    }

    await prisma.sparePart.update({ where: { id }, data: { isActive } })

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.STOCK,
      entityId: id,
      action: isActive ? AUDIT_ACTIONS.REACTIVATED : AUDIT_ACTIONS.DEACTIVATED,
      performedById: userId,
      metadata: { name: existing.name },
    })

    revalidatePath(`/stock/${id}/edit`)
    revalidatePath("/stock")
    return { success: true }
  } catch {
    return { error: "Failed to update part status" }
  }
}

/**
 * Records a stock movement and applies it to InventoryStock.quantity in the same
 * transaction. IN/RETURN increase quantity, OUT/DAMAGE decrease it, ADJUSTMENT sets
 * it directly to the entered value. Never allows quantity to go below zero.
 */
export async function recordStockMovement(partId: string, data: StockMovementInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = StockMovementSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { type, quantity, date, reference, remark } = parsed.data

  try {
    const existing = await prisma.sparePart.findFirst({ where: { id: partId, companyId }, include: { stock: true } })
    if (!existing) return { error: "Part not found" }

    if (!canAdjustStock(session.user.role as Role, session.user.modulePermissions, categoryToBucket(existing.category))) {
      return { error: "Forbidden" }
    }

    const currentQuantity = existing.stock?.quantity ?? 0
    let newQuantity: number
    switch (type) {
      case "IN":
      case "RETURN":
        newQuantity = currentQuantity + quantity
        break
      case "OUT":
      case "DAMAGE":
        newQuantity = currentQuantity - quantity
        break
      case "ADJUSTMENT":
        newQuantity = quantity
        break
    }

    if (newQuantity < 0) {
      return { error: "This movement would take stock below zero" }
    }

    const delta = newQuantity - currentQuantity
    const createdAt = date ? new Date(`${date}T12:00:00`) : undefined

    await prisma.$transaction(async (tx) => {
      await tx.inventoryStock.upsert({
        where: { partId },
        update: {
          quantity: newQuantity,
          ...(type === "ADJUSTMENT" ? { lastCounted: new Date() } : {}),
        },
        create: {
          partId,
          quantity: newQuantity,
          lastCounted: type === "ADJUSTMENT" ? new Date() : null,
        },
      })

      await tx.inventoryTransaction.create({
        data: {
          companyId,
          partId,
          type,
          quantity: delta,
          quantityBefore: currentQuantity,
          quantityAfter: newQuantity,
          referenceType: "MANUAL",
          reference: reference || null,
          remark: remark || null,
          performedById: userId,
          ...(createdAt ? { createdAt } : {}),
        },
      })
    })

    revalidatePath("/stock")
    revalidatePath("/stock/movements")
    revalidatePath(`/stock/${partId}/edit`)

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.STOCK,
      entityId: partId,
      action: AUDIT_ACTIONS.ADJUSTED,
      performedById: userId,
      metadata: { name: existing.name, movementType: type, quantity, reference: reference || null },
    })

    return { success: true }
  } catch {
    return { error: "Failed to record stock movement" }
  }
}
