"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { CustomerWithProjectsSchema, CustomerSchema } from "@/lib/schemas"
import { generateCustomerCode } from "@/lib/utils"
import { canCreateCustomer, canEditCustomer } from "@/lib/permissions"
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import { ensureCustomerFolder, DropboxError } from "@/lib/dropbox"
import type { CustomerWithProjectsInput, CustomerInput } from "@/lib/schemas"
import type { Role } from "@/types"

// Customer.code is globally @unique, but the happy-path sequence below is
// company-scoped — two concurrent creates (possibly for two *different*
// companies) can legitimately compute the same next code. Bounded retry
// resolves that without a schema change; see generateNextCustomerCode.
const MAX_CODE_ATTEMPTS = 3

// Structural check rather than `instanceof Prisma.PrismaClientKnownRequestError`:
// under this app's Turbopack dev bundling, the generated Prisma client module
// can end up duplicated across separate route/action bundles, so an error
// thrown by one copy fails an `instanceof` check made against the other copy
// even though it's genuinely the same error type. `code`/`meta` are plain,
// stable data on the error either way. The field list identifying which
// unique constraint fired also lives in different places depending on
// Prisma's query engine: the classic engine reports `meta.target`, while
// `@prisma/adapter-pg` (used here — see src/lib/prisma.ts) reports
// `meta.driverAdapterError.cause.constraint.fields` instead. Both are checked.
function isCustomerCodeCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const err = error as {
    code?: unknown
    meta?: { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } }
  }
  if (err.code !== "P2002") return false
  if (Array.isArray(err.meta?.target) && err.meta.target.includes("code")) return true
  const adapterFields = err.meta?.driverAdapterError?.cause?.constraint?.fields
  return Array.isArray(adapterFields) && adapterFields.includes("code")
}

// attempt 0 preserves the existing company-scoped numbering exactly. Retries
// (attempt > 0) only ever run after a Customer.code collision, so recomputing
// the same company-scoped count would frequently recompute the *same*
// candidate again — e.g. when the row we collided with belongs to a different
// company, this company's own count hasn't moved. The global count has, since
// it includes whatever row just collided with us, so it's what retries use.
async function generateNextCustomerCode(
  tx: Prisma.TransactionClient,
  companyId: string,
  attempt: number
): Promise<string> {
  const count = attempt === 0 ? await tx.customer.count({ where: { companyId } }) : await tx.customer.count()
  return generateCustomerCode(count + 1 + attempt)
}

export async function createCustomer(
  data: CustomerWithProjectsInput
): Promise<{ error: string } | { success: true; id: string; dropboxWarning?: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canCreateCustomer(role, permissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = CustomerWithProjectsSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form data" }

  const { companyName, shortName, pinNumber, name, phone, location, email, notes, projects } = parsed.data

  let customerId: string | undefined
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      customerId = await prisma.$transaction(async (tx) => {
        const duplicate = await tx.customer.findFirst({
          where: { companyId, shortName: { equals: shortName, mode: "insensitive" } },
          select: { id: true },
        })
        if (duplicate) throw new Error("DUPLICATE_SHORT_NAME")

        const code = await generateNextCustomerCode(tx, companyId, attempt)

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
      break
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATE_SHORT_NAME") {
        return { error: `Short Name "${shortName}" is already used by another customer` }
      }
      if (isCustomerCodeCollision(error) && attempt < MAX_CODE_ATTEMPTS - 1) {
        continue
      }
      console.error("createCustomer failed:", error)
      return { error: "Failed to create customer" }
    }
  }

  if (!customerId) {
    // Unreachable in practice (every failure path above returns early) — keeps
    // TypeScript's control-flow analysis sound without a non-null assertion.
    console.error("createCustomer failed: exhausted code retries")
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
  if (!canEditCustomer(role, permissions)) return { error: "Forbidden" }
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
  } catch (error) {
    console.error("updateCustomer failed:", error)
    return { error: "Failed to update customer" }
  }

  redirect("/customers")
}

export async function setCustomerActive(id: string, isActive: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canEditCustomer(role, permissions)) return { error: "Forbidden" }
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
