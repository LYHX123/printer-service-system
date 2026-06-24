"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CustomerSchema } from "@/lib/schemas"
import { generateCustomerCode } from "@/lib/utils"
import type { CustomerInput } from "@/lib/schemas"

export async function createCustomer(data: CustomerInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  const parsed = CustomerSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { companyName, pinNumber, name, phone, location } = parsed.data

  try {
    const count = await prisma.customer.count({ where: { companyId } })
    const code = generateCustomerCode(count + 1)

    await prisma.customer.create({
      data: {
        companyId,
        code,
        companyName,
        pinNumber: pinNumber || null,
        name: name || null,
        phone,
        location: location || null,
      },
    })
    revalidatePath("/customers")
  } catch {
    return { error: "Failed to create customer" }
  }

  redirect("/customers")
}

export async function updateCustomer(id: string, data: CustomerInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  const parsed = CustomerSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { companyName, pinNumber, name, phone, location } = parsed.data

  try {
    const existing = await prisma.customer.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Customer not found" }

    await prisma.customer.update({
      where: { id },
      data: {
        companyName,
        pinNumber: pinNumber || null,
        name: name || null,
        phone,
        location: location || null,
      },
    })
    revalidatePath("/customers")
  } catch {
    return { error: "Failed to update customer" }
  }

  redirect("/customers")
}

export async function setCustomerActive(id: string, isActive: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  try {
    const existing = await prisma.customer.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Customer not found" }

    await prisma.customer.update({ where: { id }, data: { isActive } })

    revalidatePath("/customers")
    return { success: true }
  } catch {
    return { error: "Failed to update customer status" }
  }
}
