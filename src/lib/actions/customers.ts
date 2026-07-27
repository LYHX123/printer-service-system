"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CustomerWithProjectsSchema, CustomerSchema } from "@/lib/schemas"
import { generateCustomerCode } from "@/lib/utils"
import { canAccess } from "@/lib/permissions"
import { logActivity } from "@/lib/audit"
import type { CustomerWithProjectsInput, CustomerInput } from "@/lib/schemas"
import type { Role } from "@/types"

export async function createCustomer(data: CustomerWithProjectsInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = CustomerWithProjectsSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form data" }

  const { companyName, pinNumber, name, phone, location, email, notes, projects } = parsed.data

  let customerId: string
  try {
    customerId = await prisma.$transaction(async (tx) => {
      const count = await tx.customer.count({ where: { companyId } })
      const code = generateCustomerCode(count + 1)

      const customer = await tx.customer.create({
        data: {
          companyId,
          code,
          companyName,
          pinNumber: pinNumber || null,
          name: name || null,
          phone: phone || null,
          location: location || null,
          email: email || null,
          notes: notes || null,
        },
      })

      if (projects.length > 0) {
        await tx.customerBranch.createMany({
          data: projects.map((p) => ({
            companyId,
            customerId: customer.id,
            name: p.name,
            contactPerson: p.contactPerson || null,
            phone: p.phone || null,
            contactEmail: p.contactEmail || null,
            address: p.address || null,
            notes: p.notes || null,
          })),
        })
      }

      return customer.id
    })
  } catch {
    return { error: "Failed to create customer" }
  }

  await logActivity({
    companyId,
    entityType: "Customer",
    entityId: customerId,
    action: "CREATED",
    performedById: userId,
    metadata: { companyName, projectCount: projects.length },
  })

  revalidatePath("/customers")
  redirect("/customers")
}

export async function updateCustomer(id: string, data: CustomerInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = CustomerSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { companyName, pinNumber, name, phone, location, email, notes } = parsed.data

  try {
    const existing = await prisma.customer.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Customer not found" }

    await prisma.customer.update({
      where: { id },
      data: {
        companyName,
        pinNumber: pinNumber || null,
        name: name || null,
        phone: phone || null,
        location: location || null,
        email: email || null,
        notes: notes || null,
      },
    })

    await logActivity({
      companyId,
      entityType: "Customer",
      entityId: id,
      action: "UPDATED",
      performedById: session.user.id as string,
      metadata: { companyName },
    })

    revalidatePath("/customers")
    revalidatePath(`/customers/${id}`)
  } catch {
    return { error: "Failed to update customer" }
  }

  redirect("/customers")
}

export async function setCustomerActive(id: string, isActive: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) return { error: "Forbidden" }
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
