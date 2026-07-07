import { prisma } from "@/lib/prisma"
import type { Role } from "@/types"

export type OverdueTaskAlert = {
  id: string
  title: string
  createdAt: Date
  daysOpen: number
  participants: Array<{ id: string; name: string }>
}

export type TaskStepImageItem = {
  id: string
  stepId: string
  url: string
  filename: string
  uploadedById: string
  createdAt: Date
  uploadedBy: { id: string; name: string }
}

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
  images: TaskStepImageItem[]
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

/** Role-based visibility scope shared by task queries: Admin sees all, Manager sees created/participating, others see participating only. */
function taskScopeWhere(companyId: string, userId: string, role: Role) {
  if (role === "ADMIN") return { companyId }
  if (role === "MANAGER") {
    return {
      companyId,
      OR: [{ createdById: userId }, { participants: { some: { userId } } }],
    }
  }
  return { companyId, participants: { some: { userId } } }
}

export async function getVisibleTasks(
  companyId: string,
  userId: string,
  role: Role
): Promise<TaskWithDetails[]> {
  const where = taskScopeWhere(companyId, userId, role)
  const include = {
    createdBy: { select: { id: true, name: true } },
    participants: {
      include: { user: { select: { id: true, name: true } } },
      orderBy: { id: "asc" as const },
    },
    steps: {
      include: {
        createdBy: { select: { id: true, name: true } },
        images: {
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" as const },
        },
      },
      orderBy: { order: "asc" as const },
    },
  }

  // Incomplete tasks always precede completed ones; each bucket has its own
  // sort key (newest-created first vs. newest-completed first), so this is
  // done as two ordered queries rather than one findMany with a single orderBy.
  const [activeTasks, completedTasks] = await Promise.all([
    prisma.task.findMany({
      where: { ...where, status: "ACTIVE" },
      include,
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { ...where, status: "COMPLETED" },
      include,
      orderBy: { completedAt: "desc" },
    }),
  ])

  return [...activeTasks, ...completedTasks] as unknown as TaskWithDetails[]
}

const OVERDUE_DAYS = 2

function overdueTaskWhere(companyId: string, userId: string, role: Role) {
  const cutoff = new Date(Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000)
  return {
    ...taskScopeWhere(companyId, userId, role),
    status: "ACTIVE" as const,
    createdAt: { lt: cutoff },
  }
}

export async function getOverdueTasks(
  companyId: string,
  userId: string,
  role: Role
): Promise<OverdueTaskAlert[]> {
  const where = overdueTaskWhere(companyId, userId, role)

  const tasks = await prisma.task.findMany({
    where,
    include: {
      participants: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  })

  const now = Date.now()
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    createdAt: task.createdAt,
    daysOpen: Math.floor((now - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    participants: task.participants.map((p) => ({ id: p.user.id, name: p.user.name })),
  }))
}

export async function getOverdueTaskCount(companyId: string, userId: string, role: Role): Promise<number> {
  return prisma.task.count({ where: overdueTaskWhere(companyId, userId, role) })
}

export async function getActiveTaskCount(companyId: string, userId: string, role: Role): Promise<number> {
  return prisma.task.count({
    where: { ...taskScopeWhere(companyId, userId, role), status: "ACTIVE" as const },
  })
}

/** Fetches a task step (scoped to the company) along with the parent task fields needed for permission checks. */
export async function getTaskStepForAuth(stepId: string, companyId: string) {
  return prisma.taskStep.findFirst({
    where: { id: stepId, task: { companyId } },
    include: {
      task: {
        select: {
          id: true,
          status: true,
          createdById: true,
          participants: { select: { userId: true } },
        },
      },
    },
  })
}
