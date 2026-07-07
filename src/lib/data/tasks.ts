import { prisma } from "@/lib/prisma"
import type { Role } from "@/types"

export type OverdueTaskAlert = {
  id: string
  title: string
  lastActivityAt: Date
  daysInactive: number
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

/**
 * Last Activity Date = latest of: task creation, latest status change
 * (Task.updatedAt only moves on complete/reopen — no other field on Task
 * is ever patched), latest step added, latest attachment uploaded to any
 * step. There's no separate "comment" entity in the schema; step
 * descriptions are the closest analog and are already covered by the
 * step's own createdAt.
 */
function getLastActivityAt(task: {
  createdAt: Date
  updatedAt: Date
  steps: Array<{ createdAt: Date; images: Array<{ createdAt: Date }> }>
}): Date {
  let latest = task.updatedAt > task.createdAt ? task.updatedAt : task.createdAt
  for (const step of task.steps) {
    if (step.createdAt > latest) latest = step.createdAt
    for (const image of step.images) {
      if (image.createdAt > latest) latest = image.createdAt
    }
  }
  return latest
}

/** Last-activity can't be expressed as a single SQL WHERE (it's a MAX across related tables), so overdue checks fetch ACTIVE tasks with the timestamps that feed it and filter in application code. */
function getActiveTasksWithActivity(companyId: string, userId: string, role: Role) {
  return prisma.task.findMany({
    where: { ...taskScopeWhere(companyId, userId, role), status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      steps: { select: { createdAt: true, images: { select: { createdAt: true } } } },
      participants: { select: { user: { select: { id: true, name: true } } } },
    },
  })
}

export async function getOverdueTasks(
  companyId: string,
  userId: string,
  role: Role
): Promise<OverdueTaskAlert[]> {
  const tasks = await getActiveTasksWithActivity(companyId, userId, role)
  const cutoff = Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000
  const now = Date.now()

  return tasks
    .map((task) => ({ task, lastActivityAt: getLastActivityAt(task) }))
    .filter(({ lastActivityAt }) => lastActivityAt.getTime() < cutoff)
    .sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime())
    .map(({ task, lastActivityAt }) => ({
      id: task.id,
      title: task.title,
      lastActivityAt,
      daysInactive: Math.floor((now - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)),
      participants: task.participants.map((p) => ({ id: p.user.id, name: p.user.name })),
    }))
}

export async function getOverdueTaskCount(companyId: string, userId: string, role: Role): Promise<number> {
  const tasks = await getActiveTasksWithActivity(companyId, userId, role)
  const cutoff = Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000
  return tasks.filter((task) => getLastActivityAt(task).getTime() < cutoff).length
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
