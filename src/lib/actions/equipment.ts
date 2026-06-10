"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { EquipmentSchema } from "@/lib/schemas"
import type { EquipmentInput } from "@/lib/schemas"

export async function createEquipment(data: EquipmentInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = EquipmentSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    customerId, branchId, serialNumber, assetNumber, brand, model, type,
    purchaseDate, warrantyExpiry, notes, initialBlackPages, initialColorPages,
  } = parsed.data

  let equipment: { id: string }
  try {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } })
    if (!customer) return { error: "Customer not found" }

    equipment = await prisma.equipment.create({
      data: {
        companyId,
        customerId,
        branchId: branchId || null,
        serialNumber,
        assetNumber: assetNumber || null,
        brand,
        model,
        type,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        notes: notes || null,
      },
      select: { id: true },
    })

    if (
      (type === "PRINTER" || type === "COPIER") &&
      (initialBlackPages != null || initialColorPages != null)
    ) {
      await prisma.meterReading.create({
        data: {
          equipmentId: equipment.id,
          blackPages: initialBlackPages ?? null,
          colorPages: initialColorPages ?? null,
          recordedById: userId,
          notes: "Initial reading at registration",
        },
      })
    }

    revalidatePath("/equipment")
    revalidatePath("/customers")
  } catch {
    return { error: "Failed to register equipment" }
  }

  redirect(`/equipment/${equipment.id}`)
}

export async function updateEquipment(id: string, data: EquipmentInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  const parsed = EquipmentSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    customerId, branchId, serialNumber, assetNumber, brand, model, type,
    purchaseDate, warrantyExpiry, notes,
  } = parsed.data

  try {
    const existing = await prisma.equipment.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Equipment not found" }

    await prisma.equipment.update({
      where: { id },
      data: {
        customerId,
        branchId: branchId || null,
        serialNumber,
        assetNumber: assetNumber || null,
        brand,
        model,
        type,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        notes: notes || null,
      },
    })

    revalidatePath(`/equipment/${id}`)
    revalidatePath("/equipment")
  } catch {
    return { error: "Failed to update equipment" }
  }

  redirect(`/equipment/${id}`)
}
