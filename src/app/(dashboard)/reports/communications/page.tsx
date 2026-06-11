import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Download } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getCommunicationReportList } from "@/lib/data/communications"
import { getCustomerOptions } from "@/lib/data/customers"
import { getUsers } from "@/lib/data/users"
import { PageHeader } from "@/components/ui/page-header"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChannelBadge, MessageTypeBadge } from "@/components/ui/badge"
import {
  COMMUNICATION_CHANNEL_LABELS,
  COMMUNICATION_MESSAGE_TYPE_LABELS,
} from "@/types"
import type { CommunicationChannel, CommunicationMessageType, Role } from "@/types"

const CHANNELS = Object.keys(COMMUNICATION_CHANNEL_LABELS) as CommunicationChannel[]
const MESSAGE_TYPES = Object.keys(COMMUNICATION_MESSAGE_TYPE_LABELS) as CommunicationMessageType[]

interface CommunicationsSearchParams {
  from?: string
  to?: string
  customerId?: string
  userId?: string
  channel?: string
  messageType?: string
}

export default async function CommunicationsReportPage({
  searchParams,
}: {
  searchParams: Promise<CommunicationsSearchParams>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "communications")) redirect("/dashboard")
  const companyId = session!.user.companyId as string

  const { from, to, customerId, userId, channel, messageType } = await searchParams
  const validChannel = CHANNELS.includes(channel as CommunicationChannel) ? (channel as CommunicationChannel) : undefined
  const validMessageType = MESSAGE_TYPES.includes(messageType as CommunicationMessageType)
    ? (messageType as CommunicationMessageType)
    : undefined

  const [logs, customers, users] = await Promise.all([
    getCommunicationReportList(companyId, {
      from,
      to,
      customerId,
      userId,
      channel: validChannel,
      messageType: validMessageType,
    }),
    getCustomerOptions(companyId),
    getUsers(companyId),
  ])

  const csvParams = new URLSearchParams()
  if (from) csvParams.set("from", from)
  if (to) csvParams.set("to", to)
  if (customerId) csvParams.set("customerId", customerId)
  if (userId) csvParams.set("userId", userId)
  if (validChannel) csvParams.set("channel", validChannel)
  if (validMessageType) csvParams.set("messageType", validMessageType)

  const hasFilters = Boolean(from || to || customerId || userId || validChannel || validMessageType)

  return (
    <div>
      <PageHeader
        title="Communication Report"
        subtitle="WhatsApp and email communications sent to customers."
      />

      <div className="space-y-4">
        <form method="GET" className="flex flex-wrap gap-2">
          <Input name="from" type="date" defaultValue={from ?? ""} className="w-44" aria-label="From date" />
          <Input name="to" type="date" defaultValue={to ?? ""} className="w-44" aria-label="To date" />
          <Select name="customerId" defaultValue={customerId ?? ""} className="w-52">
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </Select>
          <Select name="userId" defaultValue={userId ?? ""} className="w-52">
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
          <Select name="channel" defaultValue={validChannel ?? ""} className="w-40">
            <option value="">All Channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{COMMUNICATION_CHANNEL_LABELS[c]}</option>
            ))}
          </Select>
          <Select name="messageType" defaultValue={validMessageType ?? ""} className="w-56">
            <option value="">All Message Types</option>
            {MESSAGE_TYPES.map((m) => (
              <option key={m} value={m}>{COMMUNICATION_MESSAGE_TYPE_LABELS[m]}</option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">Filter</Button>
          {hasFilters && (
            <Link href="/reports/communications">
              <Button variant="ghost">Clear</Button>
            </Link>
          )}
          <a href={`/api/reports/communications/csv?${csvParams.toString()}`}>
            <Button type="button" variant="outline" icon={<Download className="h-3.5 w-3.5" />}>
              Export CSV
            </Button>
          </a>
        </form>

        <Table
          columns={[
            {
              key: "createdAt", label: "Date",
              render: (row) => <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.createdAt), "dd MMM yyyy HH:mm")}</span>,
            },
            {
              key: "customer", label: "Customer",
              render: (row) => (
                <Link href={`/customers/${row.customer.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                  {row.customer.name}
                </Link>
              ),
            },
            { key: "channel", label: "Channel", render: (row) => <ChannelBadge channel={row.channel} /> },
            { key: "messageType", label: "Message Type", render: (row) => <MessageTypeBadge messageType={row.messageType} /> },
            { key: "recipient", label: "Recipient", render: (row) => <span className="text-sm text-slate-600">{row.recipient}</span> },
            {
              key: "reference", label: "Reference",
              render: (row) => (
                <span className="text-xs text-slate-500">
                  {row.job ? (
                    <Link href={`/jobs/${row.job.id}`} className="hover:text-blue-600">{row.job.jobNumber}</Link>
                  ) : row.quotation ? (
                    <Link href={`/quotations/${row.quotation.id}`} className="hover:text-blue-600">{row.quotation.quotationNumber}</Link>
                  ) : (
                    "—"
                  )}
                </span>
              ),
            },
            { key: "status", label: "Status", render: (row) => <span className="text-xs text-slate-500">{row.status}</span> },
            { key: "createdBy", label: "Created By", render: (row) => <span className="text-sm text-slate-600">{row.createdBy.name}</span> },
          ]}
          data={logs}
          keyExtractor={(row) => row.id}
          emptyTitle="No communications found"
          emptyDescription="Try adjusting your filters, or communications will appear here once sent from a customer, job, or quotation page."
        />
      </div>
    </div>
  )
}
