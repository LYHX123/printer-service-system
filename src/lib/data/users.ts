import { prisma } from "@/lib/prisma"
import type { Role } from "@/types"

export type UserListItem = {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: Date
  modulePermissions: string[]
  lockedUntil: Date | null
  phone: string | null
  department: string | null
  position: string | null
}

export async function getUsers(companyId: string): Promise<UserListItem[]> {
  return prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      modulePermissions: true,
      lockedUntil: true,
      phone: true,
      department: true,
      position: true,
    },
    orderBy: { createdAt: "asc" },
  })
}
