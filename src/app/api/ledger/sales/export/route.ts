import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getSalesLedgerEntries } from "@/lib/data/ledger"
import { SALES_PAYMENT_STATUS_LABELS } from "@/types"
import type { Role, SalesPaymentStatus } from "@/types"

const VALID_STATUSES: SalesPaymentStatus[] = ["UNPAID", "PARTIAL", "PAID"]

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "ledger")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const companyId = session.user.companyId as string
  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const customerName = searchParams.get("customer") ?? undefined
  const paymentStatusParam = searchParams.get("paymentStatus") ?? undefined
  const validStatus = VALID_STATUSES.includes(paymentStatusParam as SalesPaymentStatus)
    ? (paymentStatusParam as SalesPaymentStatus)
    : undefined

  const entries = await getSalesLedgerEntries(companyId, {
    from,
    to,
    customerName,
    paymentStatus: validStatus,
    archived: false,
  })

  // Calculate totals
  let totalInvoice = 0
  let totalReceived = 0
  for (const e of entries) {
    totalInvoice += e.invoiceAmount
    totalReceived += e.amountReceived
  }
  const totalBalance = totalInvoice - totalReceived

  const header = [
    "Date",
    "Customer Name",
    "Order No / Ref No",
    "Invoice Amount",
    "Amount Received",
    "Balance",
    "Payment Status",
    "Remark",
    "Created By",
  ]

  const dataRows = entries.map((e) => [
    format(new Date(e.date), "dd MMM yyyy"),
    e.customerName,
    e.orderNo ?? "",
    e.invoiceAmount,
    e.amountReceived,
    e.balance,
    SALES_PAYMENT_STATUS_LABELS[e.paymentStatus],
    e.remark ?? "",
    e.createdBy.name,
  ])

  const summaryRows = [
    [],
    ["Total Invoice Amount", "", "", totalInvoice, "", "", "", "", ""],
    ["Total Amount Received", "", "", "", totalReceived, "", "", "", ""],
    ["Total Balance", "", "", "", "", totalBalance, "", "", ""],
  ]

  const allRows = [header, ...dataRows, ...summaryRows]

  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws["!cols"] = [
    { wch: 14 }, // Date
    { wch: 28 }, // Customer Name
    { wch: 20 }, // Order No
    { wch: 16 }, // Invoice Amount
    { wch: 16 }, // Amount Received
    { wch: 14 }, // Balance
    { wch: 14 }, // Payment Status
    { wch: 32 }, // Remark
    { wch: 18 }, // Created By
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Sales Ledger")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const today = new Date().toISOString().slice(0, 10)
  const filename = `sales-ledger-${today}.xlsx`

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
