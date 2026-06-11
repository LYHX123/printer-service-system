import { prisma } from "@/lib/prisma"
import type { Customer, User, CommunicationChannel, CommunicationMessageType } from "@/types"
import type { DateRangeFilter } from "@/lib/data/analytics"

function dateRangeWhere({ from, to }: DateRangeFilter) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  }
}

// ─── Customer communication history ────────────────────────────────────────────

export type CommunicationLogItem = {
  id: string
  channel: CommunicationChannel
  messageType: CommunicationMessageType
  recipient: string
  messageContent: string
  status: string
  createdAt: Date
  createdBy: Pick<User, "id" | "name">
}

export async function getCommunicationLogs(
  customerId: string,
  companyId: string
): Promise<CommunicationLogItem[]> {
  return prisma.communicationLog.findMany({
    where: { customerId, companyId },
    select: {
      id: true,
      channel: true,
      messageType: true,
      recipient: true,
      messageContent: true,
      status: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

// ─── Communication report ───────────────────────────────────────────────────────

export type CommunicationReportItem = CommunicationLogItem & {
  customer: Pick<Customer, "id" | "name" | "code">
  job: { id: string; jobNumber: string } | null
  quotation: { id: string; quotationNumber: string } | null
}

export interface CommunicationReportFilter extends DateRangeFilter {
  customerId?: string
  userId?: string
  channel?: CommunicationChannel
  messageType?: CommunicationMessageType
}

export async function getCommunicationReportList(
  companyId: string,
  filters: CommunicationReportFilter
): Promise<CommunicationReportItem[]> {
  const { from, to, customerId, userId, channel, messageType } = filters

  return prisma.communicationLog.findMany({
    where: {
      companyId,
      ...(customerId ? { customerId } : {}),
      ...(userId ? { createdById: userId } : {}),
      ...(channel ? { channel } : {}),
      ...(messageType ? { messageType } : {}),
      ...(from || to ? { createdAt: dateRangeWhere({ from, to }) } : {}),
    },
    select: {
      id: true,
      channel: true,
      messageType: true,
      recipient: true,
      messageContent: true,
      status: true,
      createdAt: true,
      customer: { select: { id: true, name: true, code: true } },
      job: { select: { id: true, jobNumber: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}
