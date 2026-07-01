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
  isTaskParticipant,
} from "@/lib/permissions"
import type { CreateTaskInput, AddTaskStepInput } from "@/lib/schemas"
import type { Role } from "@/types"

function revalidate() {
  revalidatePath("/tasks")
}

export async function createTask(data: CreateTaskInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks") || !canCreateTask(role)) return { error: "Forbidden" }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = CreateTaskSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { title, initialStepTitle, initialStepDescription, participantIds } = parsed.data

  try {
    await prisma.task.create({
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
    })

    revalidate()
    return { success: true as const }
  } catch {
    return { error: "Failed to create task" }
  }
}

export async function addTaskStep(taskId: string, data: AddTaskStepInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks")) return { error: "Forbidden" }

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

    await prisma.taskStep.create({
      data: { taskId, title, description: description || null, order: nextOrder, createdById: userId },
    })

    revalidate()
    return { success: true as const }
  } catch {
    return { error: "Failed to add step" }
  }
}

export async function completeTask(taskId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (!canAccess(role, "tasks")) return { error: "Forbidden" }

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
  if (!canAccess(role, "tasks") || !canReopenTask(role)) return { error: "Forbidden" }

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
  if (!canAccess(role, "tasks") || !canCreateTask(role)) return { error: "Forbidden" }

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
