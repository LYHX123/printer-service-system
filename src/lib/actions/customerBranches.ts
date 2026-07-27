"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CustomerProjectSchema, type CustomerProjectInput } from "@/lib/schemas"
import { canAccess } from "@/lib/permissions"
import { logActivity } from "@/lib/audit"
import type { Role } from "@/types"

async function assertProjectNameIsUnique(
  customerId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const trimmed = name.trim()
  const siblings = await prisma.customerBranch.findMany({
    where: { customerId, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true },
  })
  return !siblings.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())
}

export async function createCustomerBranch(customerId: string, data: CustomerProjectInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = CustomerProjectSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { name, contactPerson, phone, contactEmail, address, notes } = parsed.data

  try {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } })
    if (!customer) return { error: "Customer not found" }

    if (!(await assertProjectNameIsUnique(customerId, name))) {
      return { error: "A project with this name already exists for this customer" }
    }

    const branch = await prisma.customerBranch.create({
      data: {
        companyId,
        customerId,
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        contactEmail: contactEmail || null,
        address: address || null,
        notes: notes || null,
      },
    })

    await logActivity({
      companyId,
      entityType: "CustomerBranch",
      entityId: branch.id,
      action: "CREATED",
      performedById: session.user.id as string,
      metadata: { customerId, name },
    })

    revalidatePath(`/customers/${customerId}`)
    return { success: true as const, id: branch.id }
  } catch {
    return { error: "Failed to create project" }
  }
}

export async function updateCustomerBranch(
  customerId: string,
  branchId: string,
  data: CustomerProjectInput
) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = CustomerProjectSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { name, contactPerson, phone, contactEmail, address, notes } = parsed.data

  try {
    const existing = await prisma.customerBranch.findFirst({
      where: { id: branchId, customerId, companyId },
    })
    if (!existing) return { error: "Project not found" }

    if (!(await assertProjectNameIsUnique(customerId, name, branchId))) {
      return { error: "A project with this name already exists for this customer" }
    }

    await prisma.customerBranch.update({
      where: { id: branchId },
      data: {
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        contactEmail: contactEmail || null,
        address: address || null,
        notes: notes || null,
      },
    })

    await logActivity({
      companyId,
      entityType: "CustomerBranch",
      entityId: branchId,
      action: "UPDATED",
      performedById: session.user.id as string,
      metadata: { customerId, name },
    })

    revalidatePath(`/customers/${customerId}`)
    return { success: true as const }
  } catch {
    return { error: "Failed to update project" }
  }
}

export async function setCustomerBranchActive(
  customerId: string,
  branchId: string,
  isActive: boolean
) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  try {
    const existing = await prisma.customerBranch.findFirst({
      where: { id: branchId, customerId, companyId },
    })
    if (!existing) return { error: "Project not found" }

    await prisma.customerBranch.update({ where: { id: branchId }, data: { isActive } })

    await logActivity({
      companyId,
      entityType: "CustomerBranch",
      entityId: branchId,
      action: isActive ? "REACTIVATED" : "DEACTIVATED",
      performedById: session.user.id as string,
      metadata: { customerId },
    })

    revalidatePath(`/customers/${customerId}`)
    return { success: true as const }
  } catch {
    return { error: "Failed to update project status" }
  }
}
