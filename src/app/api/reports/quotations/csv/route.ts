import { NextResponse } from "next/server"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getQuotationReportList } from "@/lib/data/analytics"
import { toCsv, csvResponse } from "@/lib/csv"
import { QUOTATION_STATUS_LABELS, SERVICE_TYPE_LABELS } from "@/types"
import type { QuotationStatus, Role } from "@/types"

const QUOTATION_STATUSES = Object.keys(QUOTATION_STATUS_LABELS) as QuotationStatus[]

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
  const status = QUOTATION_STATUSES.includes(statusParam as QuotationStatus) ? statusParam : undefined

  const quotations = await getQuotationReportList(companyId, { from, to, customerId, engineerId, status })

  const csv = toCsv(
    ["Quotation Number", "Customer", "Created By", "Service Type", "Status", "Date", "Total Cost"],
    quotations.map((q) => [
      q.quotationNumber,
      q.customer.name,
      q.createdBy.name,
      SERVICE_TYPE_LABELS[q.serviceType],
      QUOTATION_STATUS_LABELS[q.status],
      format(new Date(q.createdAt), "yyyy-MM-dd"),
      Number(q.totalCost).toFixed(2),
    ])
  )

  return csvResponse(csv, "quotations.csv")
}
