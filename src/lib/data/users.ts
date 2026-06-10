import { prisma } from "@/lib/prisma"
import type { Role } from "@/types"

export type UserListItem = {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: Date
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
    },
    orderBy: { createdAt: "asc" },
  })
}
