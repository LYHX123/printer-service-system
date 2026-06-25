"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, ADMIN_SELF_PROTECTED } from "@/lib/permissions"
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
  if (!canManageUsers(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = CreateUserSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { name, email, password, role, modulePermissions, phone, department, position } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { error: "A user with this email already exists" }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        companyId,
        name,
        email,
        passwordHash,
        role,
        modulePermissions,
        phone: trim(phone),
        department: trim(department),
        position: trim(position),
      },
      select: { id: true },
    })
    revalidatePath("/users")
  } catch {
    return { error: "Failed to create user" }
  }

  redirect("/users")
}

export async function updateUserRole(id: string, data: UpdateUserRoleInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = UpdateUserRoleSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid role" }

  if (id === session.user.id && parsed.data.role !== "ADMIN") {
    return { error: "You cannot change your own role" }
  }

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true } })
    if (!existing) return { error: "User not found" }

    await prisma.user.update({ where: { id }, data: { role: parsed.data.role } })
    revalidatePath("/users")
    return { success: true }
  } catch {
    return { error: "Failed to update role" }
  }
}

export async function setUserActive(id: string, isActive: boolean) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  if (id === session.user.id) return { error: "You cannot disable your own account" }

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true } })
    if (!existing) return { error: "User not found" }

    await prisma.user.update({ where: { id }, data: { isActive } })
    revalidatePath("/users")
    return { success: true }
  } catch {
    return { error: "Failed to update user status" }
  }
}

export async function updateUserPermissions(id: string, data: UpdateUserPermissionsInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const currentUserId = session.user.id as string

  const parsed = UpdateUserPermissionsSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid permissions" }

  let permissions = parsed.data.modulePermissions

  // Self-protection: admin cannot accidentally remove critical modules from own account
  if (id === currentUserId) {
    for (const m of ADMIN_SELF_PROTECTED) {
      if (!permissions.includes(m)) {
        permissions = [...permissions, m]
      }
    }
  }

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true } })
    if (!existing) return { error: "User not found" }

    await prisma.user.update({ where: { id }, data: { modulePermissions: permissions } })
    revalidatePath("/users")
    return { success: true }
  } catch {
    return { error: "Failed to update permissions" }
  }
}

export async function unlockUser(id: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageUsers(session.user.role as Role)) return { error: "Forbidden" }
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
  if (!canManageUsers(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = UpdateUserProfileSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid profile data" }

  const { name, phone, department, position } = parsed.data

  try {
    const existing = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true } })
    if (!existing) return { error: "User not found" }

    await prisma.user.update({
      where: { id },
      data: {
        name,
        phone: trim(phone),
        department: trim(department),
        position: trim(position),
      },
    })
    revalidatePath("/users")
    return { success: true }
  } catch {
    return { error: "Failed to update profile" }
  }
}
