"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canCreateQuotation } from "@/lib/permissions"
import { QuotationSchema, QuotationStatusSchema } from "@/lib/schemas"
import { generateQuotationNumber } from "@/lib/utils"
import { QUOTATION_STATUS_TRANSITIONS } from "@/types"
import type { QuotationInput, QuotationStatusInput } from "@/lib/schemas"
import type { Role } from "@/types"

function computeTotal(subtotal: number, vatPercent: number): number {
  const vatAmount = (subtotal * vatPercent) / 100
  return subtotal + vatAmount
}

export async function createQuotation(data: QuotationInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateQuotation(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = QuotationSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { customerId, validUntil, vatPercent, remarks, internalNotes, items } = parsed.data

  let quotation: { id: string }
  try {
    const parts = await prisma.sparePart.findMany({
      where: { id: { in: items.map((i) => i.partId) }, companyId },
      select: { id: true, name: true, brand: true },
    })
    const partMap = new Map(parts.map((p) => [p.id, p]))
    if (parts.length !== new Set(items.map((i) => i.partId)).size) {
      return { error: "One or more stock items are invalid" }
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const count = await prisma.quotation.count({
      where: {
        companyId,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    })
    const quotationNumber = generateQuotationNumber(now, count + 1)

    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )
    const totalCost = computeTotal(subtotal, vatPercent)

    quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        companyId,
        customerId,
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
            }
          }),
        },
      },
      select: { id: true },
    })

    revalidatePath("/quotations")
  } catch {
    return { error: "Failed to create quotation" }
  }

  redirect(`/quotations/${quotation.id}`)
}

export async function updateQuotation(id: string, data: QuotationInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateQuotation(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = QuotationSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { customerId, validUntil, vatPercent, remarks, internalNotes, items } = parsed.data

  try {
    const existing = await prisma.quotation.findFirst({
      where: { id, companyId },
      select: { status: true },
    })
    if (!existing) return { error: "Quotation not found" }
    if (existing.status !== "DRAFT" && existing.status !== "SENT") {
      return { error: "Only draft or sent quotations can be edited" }
    }

    const parts = await prisma.sparePart.findMany({
      where: { id: { in: items.map((i) => i.partId) }, companyId },
      select: { id: true, name: true, brand: true },
    })
    const partMap = new Map(parts.map((p) => [p.id, p]))
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
      await tx.quotation.update({
        where: { id },
        data: {
          customerId,
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
            }
          }),
        })
      }
    })

    revalidatePath(`/quotations/${id}`)
    revalidatePath("/quotations")
  } catch {
    return { error: "Failed to update quotation" }
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
