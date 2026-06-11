"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canSendCommunications } from "@/lib/permissions"
import { CommunicationLogSchema } from "@/lib/schemas"
import type { CommunicationLogInput } from "@/lib/schemas"
import type { Role } from "@/types"

/**
 * Logs a WhatsApp/Email communication after the user has launched the
 * wa.me / mailto link client-side. No message is ever sent automatically -
 * this only records that the user initiated the send.
 */
export async function logCommunication(data: CommunicationLogInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canSendCommunications(session.user.role as Role)) return { error: "Forbidden" }

  const parsed = CommunicationLogSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid communication data" }

  const { customerId, jobId, quotationId, channel, messageType, recipient, messageContent } = parsed.data
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    await prisma.communicationLog.create({
      data: {
        companyId,
        customerId,
        jobId: jobId || null,
        quotationId: quotationId || null,
        channel,
        messageType,
        recipient,
        messageContent,
        status: "SENT",
        createdById: userId,
      },
    })

    revalidatePath(`/customers/${customerId}`)
    if (jobId) revalidatePath(`/jobs/${jobId}`)
    if (quotationId) revalidatePath(`/quotations/${quotationId}`)
    revalidatePath("/reports/communications")

    return { success: true }
  } catch {
    return { error: "Failed to log communication" }
  }
}
