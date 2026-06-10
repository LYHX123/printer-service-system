"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CustomerSchema, BranchSchema } from "@/lib/schemas"
import { generateCustomerCode } from "@/lib/utils"
import type { CustomerInput, BranchInput } from "@/lib/schemas"

export async function createCustomer(data: CustomerInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  const parsed = CustomerSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { name, companyName, phone, email, address } = parsed.data

  let customer: { id: string }
  try {
    const count = await prisma.customer.count({ where: { companyId } })
    const code = generateCustomerCode(count + 1)

    customer = await prisma.customer.create({
      data: {
        companyId,
        code,
        name,
        companyName: companyName || null,
        phone,
        email: email || null,
        address: address || null,
      },
      select: { id: true },
    })
    revalidatePath("/customers")
  } catch {
    return { error: "Failed to create customer" }
  }

  redirect(`/customers/${customer.id}`)
}

export async function updateCustomer(id: string, data: CustomerInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  const parsed = CustomerSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { name, companyName, phone, email, address } = parsed.data

  try {
    const existing = await prisma.customer.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Customer not found" }

    await prisma.customer.update({
      where: { id },
      data: {
        name,
        companyName: companyName || null,
        phone,
        email: email || null,
        address: address || null,
      },
    })
    revalidatePath(`/customers/${id}`)
    revalidatePath("/customers")
  } catch {
    return { error: "Failed to update customer" }
  }

  redirect(`/customers/${id}`)
}

export async function createBranch(customerId: string, data: BranchInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  const parsed = BranchSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { name, address, phone, contactPerson, isPrimary } = parsed.data

  try {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } })
    if (!customer) return { error: "Customer not found" }

    // If this is primary, unset others
    if (isPrimary) {
      await prisma.customerBranch.updateMany({
        where: { customerId, companyId },
        data: { isPrimary: false },
      })
    }

    await prisma.customerBranch.create({
      data: {
        companyId,
        customerId,
        name,
        address: address || null,
        phone: phone || null,
        contactPerson: contactPerson || null,
        isPrimary: isPrimary ?? false,
      },
    })

    revalidatePath(`/customers/${customerId}`)
    return { success: true }
  } catch {
    return { error: "Failed to create branch" }
  }
}
