import { prisma } from "@/lib/prisma"
import type { Role } from "@/types"

export type TaskStepItem = {
  id: string
  taskId: string
  title: string
  description: string | null
  order: number
  createdById: string
  createdAt: Date
  updatedAt: Date
  createdBy: { id: string; name: string }
}

export type TaskWithDetails = {
  id: string
  companyId: string
  title: string
  status: "ACTIVE" | "COMPLETED"
  createdById: string
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  createdBy: { id: string; name: string }
  participants: Array<{ id: string; userId: string; user: { id: string; name: string } }>
  steps: TaskStepItem[]
}

export async function getVisibleTasks(
  companyId: string,
  userId: string,
  role: Role
): Promise<TaskWithDetails[]> {
  const where =
    role === "ADMIN"
      ? { companyId }
      : role === "MANAGER"
      ? {
          companyId,
          OR: [
            { createdById: userId },
            { participants: { some: { userId } } },
          ],
        }
      : { companyId, participants: { some: { userId } } }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true } },
      participants: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { id: "asc" },
      },
      steps: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return tasks as unknown as TaskWithDetails[]
}
