import { NextResponse } from "next/server"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getCommunicationReportList } from "@/lib/data/communications"
import { toCsv, csvResponse } from "@/lib/csv"
import {
  COMMUNICATION_CHANNEL_LABELS,
  COMMUNICATION_MESSAGE_TYPE_LABELS,
} from "@/types"
import type { CommunicationChannel, CommunicationMessageType, Role } from "@/types"

const CHANNELS = Object.keys(COMMUNICATION_CHANNEL_LABELS) as CommunicationChannel[]
const MESSAGE_TYPES = Object.keys(COMMUNICATION_MESSAGE_TYPE_LABELS) as CommunicationMessageType[]

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "communications")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const customerId = searchParams.get("customerId") ?? undefined
  const userId = searchParams.get("userId") ?? undefined
  const channelParam = searchParams.get("channel") ?? undefined
  const channel = CHANNELS.includes(channelParam as CommunicationChannel) ? (channelParam as CommunicationChannel) : undefined
  const messageTypeParam = searchParams.get("messageType") ?? undefined
  const messageType = MESSAGE_TYPES.includes(messageTypeParam as CommunicationMessageType)
    ? (messageTypeParam as CommunicationMessageType)
    : undefined

  const logs = await getCommunicationReportList(companyId, { from, to, customerId, userId, channel, messageType })

  const csv = toCsv(
    ["Date", "Customer", "Channel", "Message Type", "Recipient", "Reference", "Status", "Created By"],
    logs.map((l) => [
      format(new Date(l.createdAt), "yyyy-MM-dd HH:mm"),
      l.customer.name,
      COMMUNICATION_CHANNEL_LABELS[l.channel],
      COMMUNICATION_MESSAGE_TYPE_LABELS[l.messageType],
      l.recipient,
      l.job ? l.job.jobNumber : l.quotation ? l.quotation.quotationNumber : "",
      l.status,
      l.createdBy.name,
    ])
  )

  return csvResponse(csv, "communications.csv")
}
