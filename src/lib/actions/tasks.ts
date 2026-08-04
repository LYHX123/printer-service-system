"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateTaskSchema, AddTaskStepSchema, AddTaskParticipantsSchema } from "@/lib/schemas"
import {
  canAccess,
  canCreateTask,
  canAddTaskStep,
  canCompleteTask,
  canReopenTask,
  canManageTaskStep,
  canManageTaskParticipants,
  isTaskParticipant,
} from "@/lib/permissions"
import { getTaskStepForAuth } from "@/lib/data/tasks"
import { deleteTaskStepImage } from "@/lib/uploads"
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import type { CreateTaskInput, AddTaskStepInput, AddTaskParticipantsInput } from "@/lib/schemas"
import type { Role } from "@/types"

function revalidate() {
  revalidatePath("/tasks")
}

export async function createTask(data: CreateTaskInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions) || !canCreateTask(role)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = CreateTaskSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { title, initialStepTitle, initialStepDescription, participantIds } = parsed.data

  try {
    const task = await prisma.task.create({
      data: {
        companyId,
        title,
        createdById: userId,
        participants: {
          create: participantIds.map((uid) => ({ userId: uid })),
        },
        steps: {
          create: {
            title: initialStepTitle,
            description: initialStepDescription || null,
            order: 1,
            createdById: userId,
          },
        },
      },
      include: { steps: true },
    })

    revalidate()

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      entityId: task.id,
      action: AUDIT_ACTIONS.CREATED,
      performedById: userId,
      metadata: { title, participantCount: participantIds.length },
    })

    return { success: true as const, taskId: task.id, initialStepId: task.steps[0].id }
  } catch {
    return { error: "Failed to create task" }
  }
}

export async function addTaskStep(taskId: string, data: AddTaskStepInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = AddTaskStepSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { title, description } = parsed.data

  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, companyId },
      include: { participants: { select: { userId: true } } },
    })
    if (!task) return { error: "Task not found" }

    if (!canAddTaskStep(userId, { status: task.status, createdById: task.createdById, participants: task.participants })) {
      return { error: "You are not a participant in this task or it is completed" }
    }

    const maxStep = await prisma.taskStep.aggregate({
      where: { taskId },
      _max: { order: true },
    })
    const nextOrder = (maxStep._max.order ?? 0) + 1

    const step = await prisma.taskStep.create({
      data: { taskId, title, description: description || null, order: nextOrder, createdById: userId },
    })

    revalidate()

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.TASK_STEP,
      entityId: step.id,
      action: AUDIT_ACTIONS.CREATED,
      performedById: userId,
      metadata: { taskId, title },
    })

    return { success: true as const, stepId: step.id }
  } catch {
    return { error: "Failed to add step" }
  }
}

export async function updateTaskStep(stepId: string, data: AddTaskStepInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = AddTaskStepSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { title, description } = parsed.data

  try {
    const step = await getTaskStepForAuth(stepId, companyId)
    if (!step) return { error: "Progress node not found" }
    if (!canManageTaskStep(role, userId, step, step.task)) return { error: "Forbidden" }

    const newDescription = description || null
    const changes: Record<string, { from: string | null; to: string | null }> = {}
    if (step.title !== title) changes.title = { from: step.title, to: title }
    if (step.description !== newDescription) changes.description = { from: step.description, to: newDescription }

    await prisma.taskStep.update({
      where: { id: stepId },
      data: { title, description: newDescription },
    })

    if (Object.keys(changes).length > 0) {
      await logActivity({
        companyId,
        entityType: "TaskStep",
        entityId: stepId,
        action: "TASK_NODE_UPDATED",
        performedById: userId,
        metadata: { taskId: step.taskId, changes },
      })
    }

    revalidate()
    return { success: true as const }
  } catch {
    return { error: "Failed to update progress node" }
  }
}

export async function deleteTaskStep(stepId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    const step = await getTaskStepForAuth(stepId, companyId)
    if (!step) return { error: "Progress node not found" }
    if (!canManageTaskStep(role, userId, step, step.task)) return { error: "Forbidden" }

    // Snapshot for the audit trail — never store file binaries, just enough
    // to know what was deleted (title/description text + how many images).
    const images = await prisma.taskStepImage.findMany({ where: { stepId }, select: { url: true } })

    for (const image of images) {
      await deleteTaskStepImage(image.url)
    }
    await prisma.taskStep.delete({ where: { id: stepId } })

    await logActivity({
      companyId,
      entityType: "TaskStep",
      entityId: stepId,
      action: "TASK_NODE_DELETED",
      performedById: userId,
      metadata: {
        taskId: step.taskId,
        title: step.title,
        description: step.description,
        imageCount: images.length,
      },
    })

    revalidate()
    return { success: true as const }
  } catch {
    return { error: "Failed to delete progress node" }
  }
}

export async function completeTask(taskId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, companyId },
      include: { participants: { select: { userId: true } } },
    })
    if (!task) return { error: "Task not found" }

    if (!canCompleteTask(userId, { status: task.status, createdById: task.createdById, participants: task.participants })) {
      return { error: "Cannot complete this task" }
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "COMPLETED", completedAt: new Date() },
    })

    revalidate()

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      entityId: taskId,
      action: AUDIT_ACTIONS.STATUS_CHANGED,
      performedById: userId,
      metadata: { title: task.title, toStatus: "COMPLETED" },
    })

    return { success: true as const }
  } catch {
    return { error: "Failed to complete task" }
  }
}

export async function reopenTask(taskId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions) || !canReopenTask(role)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    const task = await prisma.task.findFirst({ where: { id: taskId, companyId } })
    if (!task) return { error: "Task not found" }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "ACTIVE", completedAt: null },
    })

    revalidate()

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      entityId: taskId,
      action: AUDIT_ACTIONS.STATUS_CHANGED,
      performedById: userId,
      metadata: { title: task.title, toStatus: "ACTIVE" },
    })

    return { success: true as const }
  } catch {
    return { error: "Failed to reopen task" }
  }
}

export async function deleteTask(taskId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions) || !canCreateTask(role)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, companyId },
      include: { participants: { select: { userId: true } } },
    })
    if (!task) return { error: "Task not found" }

    if (role !== "ADMIN" && !isTaskParticipant(userId, { createdById: task.createdById, participants: task.participants })) {
      return { error: "Forbidden" }
    }

    await prisma.task.delete({ where: { id: taskId } })

    revalidate()

    await logActivity({
      companyId,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      entityId: taskId,
      action: AUDIT_ACTIONS.DELETED,
      performedById: userId,
      metadata: { title: task.title },
    })

    return { success: true as const }
  } catch {
    return { error: "Failed to delete task" }
  }
}

/**
 * Adds one or more participants to an in-progress task. Never touches
 * Task.createdById, task status, due dates, existing steps/progress, or any
 * other participant already on the task — this only ever inserts new
 * TaskParticipant rows. The whole batch is rejected (nothing partially
 * applied) if any requested user doesn't resolve to an active user in the
 * same company, since the only legitimate caller is the Add Participant
 * modal, which only ever offers such users in the first place — anything
 * else means the request was tampered with.
 */
export async function addTaskParticipants(taskId: string, data: AddTaskParticipantsInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = AddTaskParticipantsSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const requestedIds = [...new Set(parsed.data.userIds)]

  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, companyId },
      include: { participants: { select: { userId: true } } },
    })
    if (!task) return { error: "Task not found" }

    if (!canManageTaskParticipants(role, userId, { status: task.status, createdById: task.createdById })) {
      return { error: "Forbidden" }
    }

    const existingIds = new Set(task.participants.map((p) => p.userId))
    const newIds = requestedIds.filter((id) => !existingIds.has(id))
    if (newIds.length === 0) {
      return { error: "Selected user(s) are already participants" }
    }

    // Same-company + active check, in the same query that will also be used
    // to name each newly-added participant in the audit log — a cross-company
    // or inactive user id simply won't come back here, and is rejected below.
    const validUsers = await prisma.user.findMany({
      where: { id: { in: newIds }, companyId, isActive: true },
      select: { id: true, name: true },
    })
    if (validUsers.length !== newIds.length) {
      return { error: "One or more selected users are invalid" }
    }

    await prisma.taskParticipant.createMany({
      data: validUsers.map((u) => ({ taskId, userId: u.id })),
      skipDuplicates: true,
    })

    for (const u of validUsers) {
      await logActivity({
        companyId,
        entityType: "Task",
        entityId: taskId,
        action: "PARTICIPANT_ADDED",
        performedById: userId,
        metadata: { participantUserId: u.id, participantName: u.name },
      })
    }

    revalidate()
    return { success: true as const }
  } catch {
    return { error: "Failed to add participant(s)" }
  }
}

/**
 * Removes one participant from an in-progress task — only the Task↔User
 * participation row, never the User, the Task, its steps/progress, status,
 * or any other participant. Blocked if this would leave the task with zero
 * participants, matching the existing rule enforced at creation time
 * (CreateTaskSchema requires at least one participantId) rather than
 * silently introducing a new "0 participants allowed" state.
 */
export async function removeTaskParticipant(taskId: string, participantUserId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks", session.user.modulePermissions)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, companyId },
      include: { participants: { select: { id: true, userId: true, user: { select: { name: true } } } } },
    })
    if (!task) return { error: "Task not found" }

    if (!canManageTaskParticipants(role, userId, { status: task.status, createdById: task.createdById })) {
      return { error: "Forbidden" }
    }

    const participant = task.participants.find((p) => p.userId === participantUserId)
    if (!participant) return { error: "Participant not found" }

    if (task.participants.length <= 1) {
      return { error: "A task must have at least one participant" }
    }

    await prisma.taskParticipant.delete({ where: { id: participant.id } })

    await logActivity({
      companyId,
      entityType: "Task",
      entityId: taskId,
      action: "PARTICIPANT_REMOVED",
      performedById: userId,
      metadata: { participantUserId, participantName: participant.user.name },
    })

    revalidate()
    return { success: true as const }
  } catch {
    return { error: "Failed to remove participant" }
  }
}
