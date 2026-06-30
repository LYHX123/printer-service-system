import { prisma } from "@/lib/prisma"
import type { Role } from "@/types"

export type UserListItem = {
  id: string
  name: string
  username: string | null
  email: string | null
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
      username: true,
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
