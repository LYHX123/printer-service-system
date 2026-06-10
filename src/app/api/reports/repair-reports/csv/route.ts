import { NextResponse } from "next/server"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getRepairReportList } from "@/lib/data/analytics"
import { toCsv, csvResponse } from "@/lib/csv"
import { JOB_STATUS_LABELS, SERVICE_TYPE_LABELS } from "@/types"
import type { JobStatus, Role } from "@/types"

const JOB_STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[]

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const customerId = searchParams.get("customerId") ?? undefined
  const engineerId = searchParams.get("engineerId") ?? undefined
  const statusParam = searchParams.get("status") ?? undefined
  const status = JOB_STATUSES.includes(statusParam as JobStatus) ? statusParam : undefined

  const reports = await getRepairReportList(companyId, { from, to, customerId, engineerId, status })

  const csv = toCsv(
    ["Job Number", "Customer", "Engineer", "Service Type", "Status", "Report Date", "Completed Date", "Total Cost"],
    reports.map((r) => [
      r.jobNumber,
      r.customer.name,
      r.assignedTo.name,
      SERVICE_TYPE_LABELS[r.serviceType],
      JOB_STATUS_LABELS[r.status],
      format(new Date(r.createdAt), "yyyy-MM-dd"),
      r.completedAt ? format(new Date(r.completedAt), "yyyy-MM-dd") : "",
      r.totalCost.toFixed(2),
    ])
  )

  return csvResponse(csv, "repair-reports.csv")
}
