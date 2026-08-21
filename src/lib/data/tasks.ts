import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
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
  lastActivityAt: Date
  createdBy: { id: string; name: string }
  participants: Array<{ id: string; userId: string; user: { id: string; name: string } }>
  steps: TaskStepItem[]
  /** True when this task has new activity the current user (getVisibleTasks' `userId`) hasn't seen yet — see touchTaskActivity/markTaskAsRead. */
  unread: boolean
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
    // Single joined subquery (0-or-1 row per task) for the current user's own
    // read marker — not an N+1, and cheap enough to always fetch alongside
    // the rest of the task's detail. Used only to compute `unread` below.
    readStates: {
      where: { userId },
      select: { lastViewedAt: true },
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

  const withUnread = (task: (typeof activeTasks)[number]) => {
    const { readStates, ...rest } = task
    // Unread is a participant-scoped notion (see Sidebar's hasUnreadTasks) —
    // an ADMIN browsing a task they're neither the creator of nor a listed
    // participant on never shows an unread marker for it, even though ADMIN
    // visibility (taskScopeWhere) lets them see the task at all.
    const isParticipant = rest.createdById === userId || rest.participants.some((p) => p.userId === userId)
    const lastViewedAt = readStates[0]?.lastViewedAt ?? null
    return { ...rest, unread: isParticipant && (!lastViewedAt || task.lastActivityAt > lastViewedAt) }
  }

  return [...activeTasks.map(withUnread), ...completedTasks.map(withUnread)] as unknown as TaskWithDetails[]
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

// ─── Unread / new-activity notifications ───────────────────────────────────
// See prisma/schema.prisma's Task.lastActivityAt / TaskReadState comments for
// the design. Deliberately separate from getOverdueTasks/getLastActivityAt
// above — that's an unrelated "no activity in N days" alert, not per-user
// read state, and is left untouched.

/**
 * Bumps a task's business-activity clock and, in the same transaction, marks
 * it as just-viewed for the user who performed the action — so the actor
 * never sees an unread badge appear for their own change. Call this from
 * every server action/route that represents a real Task business event (see
 * the call sites in src/lib/actions/tasks.ts and the step-image API routes).
 * Never call this for plain reads or unrelated field churn.
 */
export async function touchTaskActivity(taskId: string, actingUserId: string): Promise<void> {
  const now = new Date()
  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { lastActivityAt: now } }),
    prisma.taskReadState.upsert({
      where: { taskId_userId: { taskId, userId: actingUserId } },
      create: { taskId, userId: actingUserId, lastViewedAt: now },
      update: { lastViewedAt: now },
    }),
  ])
}

/**
 * Marks a task as viewed by a user (upserts TaskReadState.lastViewedAt = now).
 * Callers MUST already have verified companyId + view permission for this
 * task/user before calling — this function performs no authorization itself,
 * only the write, so a read state can never be created for an arbitrary
 * taskId the caller hasn't already checked.
 *
 * Returns whether the task was actually unread beforehand, so the caller can
 * skip a client-side refresh when marking an already-read task as read again.
 */
export async function markTaskViewed(
  taskId: string,
  userId: string,
  lastActivityAt: Date
): Promise<{ wasUnread: boolean }> {
  const now = new Date()
  const existing = await prisma.taskReadState.findUnique({
    where: { taskId_userId: { taskId, userId } },
    select: { lastViewedAt: true },
  })
  const wasUnread = !existing || lastActivityAt > existing.lastViewedAt

  await prisma.taskReadState.upsert({
    where: { taskId_userId: { taskId, userId } },
    create: { taskId, userId, lastViewedAt: now },
    update: { lastViewedAt: now },
  })

  return { wasUnread }
}

/**
 * Lightweight existence check for the Sidebar red dot — does this user have
 * at least one unread task? Scoped strictly to tasks they created or
 * participate in (never role-based visibility like ADMIN's "see all company
 * tasks", which is a separate concern from personal unread state) and to
 * their own company. A single EXISTS query, not a fetch-then-filter — see
 * the performance note in prisma/schema.prisma's TaskReadState comment.
 */
export async function hasUnreadTasks(companyId: string, userId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM "Task" t
      WHERE t."companyId" = ${companyId}
        AND (
          t."createdById" = ${userId}
          OR EXISTS (SELECT 1 FROM "TaskParticipant" tp WHERE tp."taskId" = t.id AND tp."userId" = ${userId})
        )
        AND (
          NOT EXISTS (SELECT 1 FROM "TaskReadState" rs WHERE rs."taskId" = t.id AND rs."userId" = ${userId})
          OR t."lastActivityAt" > (
            SELECT rs."lastViewedAt" FROM "TaskReadState" rs WHERE rs."taskId" = t.id AND rs."userId" = ${userId}
          )
        )
    ) AS "exists"
  `)
  return rows[0]?.exists ?? false
}
