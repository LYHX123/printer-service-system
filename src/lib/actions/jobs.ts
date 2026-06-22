"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  JobSchema,
  StatusUpdateSchema,
  AssignEngineerSchema,
  TechnicianNotesSchema,
} from "@/lib/schemas"
import { generateJobNumber } from "@/lib/utils"
import { saveJobSignature as saveJobSignatureFile } from "@/lib/uploads"
import { canCreateJob, canUpdateJobStatus, canUploadJobMedia } from "@/lib/permissions"
import { JOB_STATUS_TRANSITIONS } from "@/types"
import type {
  JobInput,
  StatusUpdateInput,
  AssignEngineerInput,
  TechnicianNotesInput,
} from "@/lib/schemas"
import type { Role } from "@/types"

export async function createJob(data: JobInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateJob(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = JobSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const {
    customerId, branchId, equipmentId, serviceType, assignedToId,
    priority, problemDesc, dueDate, internalNotes, meterBlack, meterColor,
  } = parsed.data

  let job: { id: string }
  try {
    const year = new Date().getFullYear()
    const count = await prisma.serviceJob.count({
      where: {
        companyId,
        receivedDate: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    })
    const jobNumber = generateJobNumber(count + 1)

    job = await prisma.serviceJob.create({
      data: {
        jobNumber,
        companyId,
        customerId,
        branchId: branchId || null,
        equipmentId,
        serviceType,
        assignedToId,
        createdById: userId,
        priority,
        problemDesc,
        dueDate: dueDate ? new Date(dueDate) : null,
        internalNotes: internalNotes || null,
        meterBlack: meterBlack ?? null,
        meterColor: meterColor ?? null,
      },
      select: { id: true },
    })

    await prisma.jobStatusLog.create({
      data: {
        jobId: job.id,
        changedById: userId,
        fromStatus: "",
        toStatus: "RECEIVED",
        note: "Job created",
      },
    })

    if (meterBlack != null || meterColor != null) {
      const equip = await prisma.equipment.findUnique({
        where: { id: equipmentId },
        select: { type: true },
      })
      if (equip && (equip.type === "PRINTER" || equip.type === "COPIER")) {
        await prisma.meterReading.create({
          data: {
            equipmentId,
            jobId: job.id,
            blackPages: meterBlack ?? null,
            colorPages: meterColor ?? null,
            recordedById: userId,
          },
        })
      }
    }

    revalidatePath("/jobs")
  } catch {
    return { error: "Failed to create job" }
  }

  redirect(`/jobs/${job.id}`)
}

export async function updateJobStatus(jobId: string, data: StatusUpdateInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canUpdateJobStatus(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = StatusUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  try {
    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, companyId },
      select: { status: true, signatureUrl: true, jobNumber: true },
    })
    if (!job) return { error: "Job not found" }

    const allowed = JOB_STATUS_TRANSITIONS[job.status]
    if (!allowed.includes(parsed.data.toStatus)) {
      return { error: `Cannot move from ${job.status} to ${parsed.data.toStatus}` }
    }

    if (parsed.data.toStatus === "DELIVERED" && !job.signatureUrl) {
      return { error: "Customer signature is required before marking as Delivered" }
    }

    const completedAt = parsed.data.toStatus === "DELIVERED" ? new Date() : undefined
    const warrantyExpires =
      parsed.data.toStatus === "DELIVERED" && parsed.data.warrantyPeriod && completedAt
        ? new Date(completedAt.getTime() + parsed.data.warrantyPeriod * 24 * 60 * 60 * 1000)
        : undefined

    await prisma.$transaction(async (tx) => {
      await tx.serviceJob.update({
        where: { id: jobId },
        data: {
          status: parsed.data.toStatus,
          ...(completedAt ? { completedAt } : {}),
          ...(parsed.data.toStatus === "DELIVERED"
            ? { warrantyPeriod: parsed.data.warrantyPeriod, warrantyExpires }
            : {}),
        },
      })

      await tx.jobStatusLog.create({
        data: {
          jobId,
          changedById: session.user.id as string,
          fromStatus: job.status,
          toStatus: parsed.data.toStatus,
          note: parsed.data.note || null,
        },
      })

      if (parsed.data.toStatus === "DELIVERED") {
        const alreadyDeducted = await tx.inventoryTransaction.findFirst({
          where: { jobId, type: "OUT" },
          select: { id: true },
        })

        const usedParts = alreadyDeducted
          ? []
          : await tx.jobPart.findMany({
              where: { report: { jobId }, partId: { not: null } },
              select: { partId: true, quantity: true },
            })

        for (const usedPart of usedParts) {
          const partId = usedPart.partId!
          const stock = await tx.inventoryStock.findUnique({ where: { partId } })
          const newQty = (stock?.quantity ?? 0) - usedPart.quantity

          await tx.inventoryStock.upsert({
            where: { partId },
            update: { quantity: newQty },
            create: { partId, quantity: newQty },
          })

          await tx.inventoryTransaction.create({
            data: {
              companyId,
              partId,
              jobId,
              type: "OUT",
              quantity: -usedPart.quantity,
              reference: `Used in job ${job.jobNumber}`,
              performedById: session.user.id as string,
            },
          })
        }
      }
    })

    revalidatePath(`/jobs/${jobId}`)
    revalidatePath("/jobs")
    if (parsed.data.toStatus === "DELIVERED") {
      revalidatePath("/stock")
    }
    return { success: true }
  } catch {
    return { error: "Failed to update status" }
  }
}

export async function assignEngineer(jobId: string, data: AssignEngineerInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  if (role !== "ADMIN" && role !== "MANAGER") return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  const parsed = AssignEngineerSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  try {
    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, companyId },
      select: { id: true },
    })
    if (!job) return { error: "Job not found" }

    await prisma.serviceJob.update({
      where: { id: jobId },
      data: { assignedToId: parsed.data.assignedToId },
    })

    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch {
    return { error: "Failed to assign engineer" }
  }
}

export async function updateTechnicianNotes(jobId: string, data: TechnicianNotesInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string

  const parsed = TechnicianNotesSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  try {
    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, companyId },
      select: { id: true },
    })
    if (!job) return { error: "Job not found" }

    await prisma.serviceJob.update({
      where: { id: jobId },
      data: { technicianNotes: parsed.data.technicianNotes || null },
    })

    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch {
    return { error: "Failed to save notes" }
  }
}

export async function saveJobSignature(jobId: string, dataUrl: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canUploadJobMedia(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  try {
    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, companyId },
      select: { id: true },
    })
    if (!job) return { error: "Job not found" }

    const fileUrl = await saveJobSignatureFile(jobId, dataUrl)

    await prisma.serviceJob.update({
      where: { id: jobId },
      data: { signatureUrl: fileUrl, signedAt: new Date() },
    })

    revalidatePath(`/jobs/${jobId}/signature`)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch {
    return { error: "Failed to save signature" }
  }
}

export async function declineSignature(jobId: string, note: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canUploadJobMedia(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string

  try {
    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, companyId },
      select: { status: true },
    })
    if (!job) return { error: "Job not found" }

    await prisma.jobStatusLog.create({
      data: {
        jobId,
        changedById: session.user.id as string,
        fromStatus: job.status,
        toStatus: job.status,
        note: `Customer declined to sign: ${note}`,
      },
    })

    revalidatePath(`/jobs/${jobId}/signature`)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch {
    return { error: "Failed to record decline" }
  }
}
