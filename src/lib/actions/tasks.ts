"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateTaskSchema, AddTaskStepSchema } from "@/lib/schemas"
import {
  canAccess,
  canCreateTask,
  canAddTaskStep,
  canCompleteTask,
  canReopenTask,
  canManageTaskStep,
  isTaskParticipant,
} from "@/lib/permissions"
import { getTaskStepForAuth } from "@/lib/data/tasks"
import { deleteTaskStepImage } from "@/lib/uploads"
import { logActivity } from "@/lib/audit"
import type { CreateTaskInput, AddTaskStepInput } from "@/lib/schemas"
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

  try {
    const task = await prisma.task.findFirst({ where: { id: taskId, companyId } })
    if (!task) return { error: "Task not found" }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "ACTIVE", completedAt: null },
    })

    revalidate()
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
    return { success: true as const }
  } catch {
    return { error: "Failed to delete task" }
  }
}
