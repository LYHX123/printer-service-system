"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, ADMIN_SELF_PROTECTED_PERMISSIONS } from "@/lib/permissions"
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import {
  CreateUserSchema,
  UpdateUserRoleSchema,
  UpdateUserPermissionsSchema,
  UpdateUserProfileSchema,
} from "@/lib/schemas"
import type {
  CreateUserInput,
  UpdateUserRoleInput,
  UpdateUserPermissionsInput,
  UpdateUserProfileInput,
} from "@/lib/schemas"
import type { Role } from "@/types"

function trim(v: string | undefined | null): string | null {
  const s = v?.trim()
  return s ? s : null
}

export async function createUser(data: CreateUserInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const performedById = session.user.id as string

  const parsed = CreateUserSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { name, email, password, role, modulePermissions, phone, department, position } = parsed.data

  // Name is the login identifier now — must be unique within the company.
  const existingByName = await prisma.user.findFirst({ where: { name, companyId }, select: { id: true } })
  if (existingByName) return { error: "A user with this name already exists" }

  // Check email uniqueness (only if email is provided)
  if (email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existingByEmail) return { error: "A user with this email already exists" }
  }

  let createdId: string
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const created = await prisma.user.create({
      data: {
        companyId,
        name,
        email: email || null,
        passwordHash,
        role,
        modulePermissions,
        phone: trim(phone),
        department: trim(department),
        position: trim(position),
      },
      select: { id: true },
    })
    createdId = created.id
    revalidatePath("/users")
  } catch {
    return { error: "Failed to create user" }
  }

  // Never log the password itself — only who/what/when, matching the rest
  // of this file's password-reset handling in updateUserProfile below.
  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: createdId,
    action: AUDIT_ACTIONS.CREATED,
    performedById,
    metadata: { name, role },
  })

  redirect("/users")
}

export async function updateUserRole(id: string, data: UpdateUserRoleInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = UpdateUserRoleSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid role" }

  if (id === session.user.id && parsed.data.role !== "ADMIN") {
    return { error: "You cannot change your own role" }
  }

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true, name: true, role: true } })
    if (!existing) return { error: "User not found" }

    await prisma.user.update({ where: { id }, data: { role: parsed.data.role } })
    revalidatePath("/users")

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: id,
      action: AUDIT_ACTIONS.ROLE_CHANGED,
      performedById: session.user.id as string,
      metadata: { name: existing.name, from: existing.role, to: parsed.data.role },
    })

    return { success: true }
  } catch {
    return { error: "Failed to update role" }
  }
}

export async function setUserActive(id: string, isActive: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  if (id === session.user.id) return { error: "You cannot disable your own account" }

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true, name: true } })
    if (!existing) return { error: "User not found" }

    await prisma.user.update({ where: { id }, data: { isActive } })
    revalidatePath("/users")

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: id,
      action: isActive ? AUDIT_ACTIONS.REACTIVATED : AUDIT_ACTIONS.DEACTIVATED,
      performedById: session.user.id as string,
      metadata: { name: existing.name },
    })

    return { success: true }
  } catch {
    return { error: "Failed to update user status" }
  }
}

export async function updateUserPermissions(id: string, data: UpdateUserPermissionsInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const currentUserId = session.user.id as string

  const parsed = UpdateUserPermissionsSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid permissions" }

  let permissions: string[] = parsed.data.modulePermissions

  // Self-protection: admin cannot accidentally remove critical modules from own account
  if (id === currentUserId) {
    for (const key of ADMIN_SELF_PROTECTED_PERMISSIONS) {
      if (!permissions.includes(key)) permissions = [...permissions, key]
    }
  }

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true, name: true, modulePermissions: true } })
    if (!existing) return { error: "User not found" }

    await prisma.user.update({ where: { id }, data: { modulePermissions: permissions } })
    revalidatePath("/users")

    const before = new Set(existing.modulePermissions)
    const after = new Set(permissions)
    const addedPermissions = permissions.filter((p) => !before.has(p))
    const removedPermissions = existing.modulePermissions.filter((p) => !after.has(p))

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: id,
      action: AUDIT_ACTIONS.PERMISSIONS_UPDATED,
      performedById: currentUserId,
      metadata: { name: existing.name, addedPermissions, removedPermissions },
    })

    return { success: true }
  } catch {
    return { error: "Failed to update permissions" }
  }
}

export async function unlockUser(id: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true } })
    if (!existing) return { error: "User not found" }

    await prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
    revalidatePath("/users")
    return { success: true }
  } catch {
    return { error: "Failed to unlock user" }
  }
}

export async function updateUserProfile(id: string, data: UpdateUserProfileInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role, session.user.modulePermissions)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = UpdateUserProfileSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid profile data" }

  const { name, phone, department, position, newPassword } = parsed.data

  // Name is the login identifier now — must stay unique within the company.
  const existingByName = await prisma.user.findFirst({
    where: { name, companyId, NOT: { id } },
    select: { id: true },
  })
  if (existingByName) return { error: "A user with this name already exists" }

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true, name: true } })
    if (!existing) return { error: "User not found" }

    const updateData: Record<string, unknown> = {
      name,
      phone: trim(phone),
      department: trim(department),
      position: trim(position),
    }

    const isPasswordReset = Boolean(newPassword && newPassword.trim().length >= 8)
    if (isPasswordReset) {
      updateData.passwordHash = await bcrypt.hash(newPassword!.trim(), 10)
    }

    await prisma.user.update({ where: { id }, data: updateData })
    revalidatePath("/users")

    // Never log the password itself, old or new — only that a reset happened.
    if (isPasswordReset) {
      await logActivity({
        companyId,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: id,
        action: AUDIT_ACTIONS.PASSWORD_RESET,
        performedById: session.user.id as string,
        metadata: { name },
      })
    }
    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: id,
      action: AUDIT_ACTIONS.UPDATED,
      performedById: session.user.id as string,
      metadata: { name },
    })

    return { success: true }
  } catch {
    return { error: "Failed to update profile" }
  }
}
