"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { RepairReportSchema, type RepairReportInput } from "@/lib/schemas"

export async function saveRepairReport(jobId: string, data: RepairReportInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = RepairReportSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { diagnosis, workDone, recommendations, labourCost, parts } = parsed.data

  try {
    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, companyId },
      select: { id: true },
    })
    if (!job) return { error: "Job not found" }

    const partsCost = parts.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0)
    const totalCost = labourCost + partsCost

    await prisma.$transaction(async (tx) => {
      const report = await tx.repairReport.upsert({
        where: { jobId },
        create: {
          jobId,
          writtenById: userId,
          diagnosis,
          workDone,
          recommendations: recommendations || null,
          labourCost,
          partsCost,
        },
        update: {
          writtenById: userId,
          diagnosis,
          workDone,
          recommendations: recommendations || null,
          labourCost,
          partsCost,
        },
      })

      await tx.jobPart.deleteMany({ where: { reportId: report.id } })
      if (parts.length > 0) {
        await tx.jobPart.createMany({
          data: parts.map((p) => ({
            reportId: report.id,
            partId: p.partId || null,
            partName: p.partName,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            subtotal: p.quantity * p.unitPrice,
          })),
        })
      }

      await tx.serviceJob.update({
        where: { id: jobId },
        data: { labourCost, partsCost, totalCost },
      })
    })

    revalidatePath(`/jobs/${jobId}/report`)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch {
    return { error: "Failed to save repair report" }
  }
}
