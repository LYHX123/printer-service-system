"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SparePartSchema, StockMovementSchema } from "@/lib/schemas"
import { generatePartNumber } from "@/lib/utils"
import { canManageInventory } from "@/lib/permissions"
import { getStockType } from "@/lib/stock-types"
import type { SparePartInput, StockMovementInput } from "@/lib/schemas"
import type { Role } from "@/types"

export async function createSparePart(
  data: SparePartInput
): Promise<{ error: string } | { success: true; id: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageInventory(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = SparePartSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    partNumber, name, description, category, brand, supplier, compatibleWith,
    unit, unitCost, sellingPrice, reorderLevel, location, quantity,
  } = parsed.data

  let part: { id: string }
  try {
    let finalPartNumber = partNumber.trim()
    if (!finalPartNumber) {
      const count = await prisma.sparePart.count({ where: { companyId } })
      finalPartNumber = generatePartNumber(count + 1)
    } else {
      const existing = await prisma.sparePart.findFirst({ where: { partNumber: finalPartNumber, companyId } })
      if (existing) return { error: "A part with this part number already exists" }
    }

    part = await prisma.$transaction(async (tx) => {
      const created = await tx.sparePart.create({
        data: {
          companyId,
          partNumber: finalPartNumber,
          name,
          description: description || null,
          category,
          brand: brand || null,
          supplier: supplier || null,
          compatibleWith: compatibleWith || null,
          unit,
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

  return { success: true as const, id: part.id }
}

export async function updateSparePart(id: string, data: SparePartInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageInventory(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = SparePartSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    partNumber, name, description, category, brand, supplier, compatibleWith,
    unit, unitCost, sellingPrice, reorderLevel, location, quantity,
  } = parsed.data

  try {
    const existing = await prisma.sparePart.findFirst({ where: { id, companyId }, include: { stock: true } })
    if (!existing) return { error: "Part not found" }

    if (partNumber.trim() && partNumber !== existing.partNumber) {
      const dup = await prisma.sparePart.findFirst({ where: { partNumber, companyId, NOT: { id } } })
      if (dup) return { error: "A part with this part number already exists" }
    }

    const currentQuantity = existing.stock?.quantity ?? 0
    const quantityDelta = quantity - currentQuantity

    await prisma.$transaction(async (tx) => {
      await tx.sparePart.update({
        where: { id },
        data: {
          partNumber: partNumber.trim() || existing.partNumber,
          name,
          description: description || null,
          category,
          brand: brand || null,
          supplier: supplier || null,
          compatibleWith: compatibleWith || null,
          unit,
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

  redirect(`/stock?type=${getStockType(category)}`)
}

export async function setSparePartActive(id: string, isActive: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageInventory(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  try {
    const existing = await prisma.sparePart.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Part not found" }

    await prisma.sparePart.update({ where: { id }, data: { isActive } })

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
  if (!canManageInventory(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = StockMovementSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { type, quantity, date, reference, remark } = parsed.data

  try {
    const existing = await prisma.sparePart.findFirst({ where: { id: partId, companyId }, include: { stock: true } })
    if (!existing) return { error: "Part not found" }

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
    return { success: true }
  } catch {
    return { error: "Failed to record stock movement" }
  }
}
