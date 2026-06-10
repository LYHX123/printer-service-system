"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SparePartSchema, StockTransactionSchema } from "@/lib/schemas"
import { generatePartNumber } from "@/lib/utils"
import { canManageInventory } from "@/lib/permissions"
import type { SparePartInput, StockTransactionInput } from "@/lib/schemas"
import type { Role } from "@/types"

export async function createSparePart(data: SparePartInput) {
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

    revalidatePath("/inventory")
  } catch {
    return { error: "Failed to create spare part" }
  }

  redirect(`/inventory/${part.id}`)
}

export async function updateSparePart(id: string, data: SparePartInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageInventory(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = SparePartSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    partNumber, name, description, category, brand, supplier, compatibleWith,
    unit, unitCost, sellingPrice, reorderLevel, location,
  } = parsed.data

  try {
    const existing = await prisma.sparePart.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Part not found" }

    if (partNumber.trim() && partNumber !== existing.partNumber) {
      const dup = await prisma.sparePart.findFirst({ where: { partNumber, companyId, NOT: { id } } })
      if (dup) return { error: "A part with this part number already exists" }
    }

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
        update: { location: location || null },
        create: { partId: id, quantity: 0, location: location || null },
      })
    })

    revalidatePath(`/inventory/${id}`)
    revalidatePath("/inventory")
  } catch {
    return { error: "Failed to update spare part" }
  }

  redirect(`/inventory/${id}`)
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

    revalidatePath(`/inventory/${id}`)
    revalidatePath("/inventory")
    return { success: true }
  } catch {
    return { error: "Failed to update part status" }
  }
}

export async function recordStockTransaction(partId: string, data: StockTransactionInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageInventory(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = StockTransactionSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { type, quantity, unitPrice, reference } = parsed.data

  try {
    const part = await prisma.sparePart.findFirst({
      where: { id: partId, companyId },
      include: { stock: true },
    })
    if (!part) return { error: "Part not found" }

    const currentQty = part.stock?.quantity ?? 0

    let newQty: number
    let txQuantity: number
    if (type === "IN") {
      newQty = currentQty + quantity
      txQuantity = quantity
    } else if (type === "OUT") {
      if (quantity > currentQty) return { error: "Insufficient stock for this transaction" }
      newQty = currentQty - quantity
      txQuantity = -quantity
    } else {
      // ADJUSTMENT: quantity entered is the new counted total
      newQty = quantity
      txQuantity = newQty - currentQty
    }

    await prisma.$transaction(async (tx) => {
      await tx.inventoryTransaction.create({
        data: {
          companyId,
          partId,
          jobId: null,
          type,
          quantity: txQuantity,
          unitPrice: unitPrice ?? null,
          reference: reference || null,
          performedById: userId,
        },
      })

      await tx.inventoryStock.upsert({
        where: { partId },
        update: {
          quantity: newQty,
          ...(type === "ADJUSTMENT" ? { lastCounted: new Date() } : {}),
        },
        create: {
          partId,
          quantity: newQty,
          lastCounted: type === "ADJUSTMENT" ? new Date() : null,
        },
      })

      if (type === "IN" && unitPrice != null) {
        await tx.sparePart.update({ where: { id: partId }, data: { unitCost: unitPrice } })
      }
    })

    revalidatePath(`/inventory/${partId}`)
    revalidatePath("/inventory")
    return { success: true }
  } catch {
    return { error: "Failed to record stock transaction" }
  }
}
