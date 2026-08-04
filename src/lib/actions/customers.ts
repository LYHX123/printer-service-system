"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CustomerWithProjectsSchema, CustomerSchema } from "@/lib/schemas"
import { generateCustomerCode } from "@/lib/utils"
import { canAccess } from "@/lib/permissions"
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import { ensureCustomerFolder, DropboxError } from "@/lib/dropbox"
import type { CustomerWithProjectsInput, CustomerInput } from "@/lib/schemas"
import type { Role } from "@/types"

export async function createCustomer(
  data: CustomerWithProjectsInput
): Promise<{ error: string } | { success: true; id: string; dropboxWarning?: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = CustomerWithProjectsSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form data" }

  const { companyName, shortName, pinNumber, name, phone, location, email, notes, projects } = parsed.data

  let customerId: string
  try {
    customerId = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.customer.findFirst({
        where: { companyId, shortName: { equals: shortName, mode: "insensitive" } },
        select: { id: true },
      })
      if (duplicate) throw new Error("DUPLICATE_SHORT_NAME")

      const count = await tx.customer.count({ where: { companyId } })
      const code = generateCustomerCode(count + 1)

      const customer = await tx.customer.create({
        data: {
          companyId,
          code,
          companyName,
          shortName,
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
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_SHORT_NAME") {
      return { error: `Short Name "${shortName}" is already used by another customer` }
    }
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

  // Best-effort: the customer record is already safely committed above, so a
  // Dropbox hiccup here (API down, connection expired, ...) must never make
  // customer creation itself fail. The folder is idempotently re-ensured on
  // every later document upload anyway (see ensureCustomerFolder), so this
  // is purely a "have it ready right away" convenience, not a requirement.
  let dropboxWarning: string | undefined
  try {
    await ensureCustomerFolder(companyId, shortName)
  } catch (error) {
    dropboxWarning = error instanceof DropboxError ? error.message : "Failed to create Dropbox folder for this customer."
    console.error("createCustomer: ensureCustomerFolder failed:", dropboxWarning)
  }

  return { success: true as const, id: customerId, ...(dropboxWarning ? { dropboxWarning } : {}) }
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

  const { companyName, shortName, pinNumber, name, phone, location, email, notes } = parsed.data

  try {
    const existing = await prisma.customer.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Customer not found" }

    const duplicate = await prisma.customer.findFirst({
      where: { companyId, id: { not: id }, shortName: { equals: shortName, mode: "insensitive" } },
      select: { id: true },
    })
    if (duplicate) return { error: `Short Name "${shortName}" is already used by another customer` }

    await prisma.customer.update({
      where: { id },
      data: {
        companyName,
        shortName,
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
  const userId = session.user.id as string

  try {
    const existing = await prisma.customer.findFirst({ where: { id, companyId } })
    if (!existing) return { error: "Customer not found" }

    await prisma.customer.update({ where: { id }, data: { isActive } })

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      entityId: id,
      action: isActive ? AUDIT_ACTIONS.REACTIVATED : AUDIT_ACTIONS.DEACTIVATED,
      performedById: userId,
      metadata: { companyName: existing.companyName },
    })

    revalidatePath("/customers")
    return { success: true }
  } catch {
    return { error: "Failed to update customer status" }
  }
}
