import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getLedgerEntries } from "@/lib/data/ledger"
import type { LedgerEntryType, Role } from "@/types"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MPESA: "M-Pesa",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  CASH: "Cash",
}

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
  const typeParam = searchParams.get("type") ?? undefined
  const categoryId = searchParams.get("categoryId") ?? undefined
  const search = searchParams.get("search") ?? undefined

  const VALID_TYPES: LedgerEntryType[] = ["INCOME", "EXPENSE"]
  const validType = VALID_TYPES.includes(typeParam as LedgerEntryType)
    ? (typeParam as LedgerEntryType)
    : undefined

  const entries = await getLedgerEntries(companyId, {
    from,
    to,
    type: validType,
    categoryId,
    search,
  })

  // Calculate totals
  let totalIncome = 0
  let totalExpense = 0
  for (const e of entries) {
    if (e.type === "INCOME") totalIncome += Number(e.amount)
    else totalExpense += Number(e.amount)
  }
  const balance = totalIncome - totalExpense

  // Build worksheet rows
  const header = [
    "Date",
    "Type",
    "Category",
    "Amount",
    "Payment / Receiving Method",
    "Remark",
    "Created By",
  ]

  const dataRows = entries.map((e) => [
    format(new Date(e.date), "dd MMM yyyy"),
    e.type === "INCOME" ? "Income" : "Expense",
    e.category.name,
    Number(e.amount),
    PAYMENT_METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod,
    e.remark ?? "",
    e.createdBy.name,
  ])

  const summaryRows = [
    [],
    ["Total Income", "", "", totalIncome, "", "", ""],
    ["Total Expense", "", "", totalExpense, "", "", ""],
    ["Balance", "", "", balance, "", "", ""],
  ]

  const allRows = [header, ...dataRows, ...summaryRows]

  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // Column widths
  ws["!cols"] = [
    { wch: 14 }, // Date
    { wch: 10 }, // Type
    { wch: 20 }, // Category
    { wch: 12 }, // Amount
    { wch: 22 }, // Payment Method
    { wch: 30 }, // Remark
    { wch: 18 }, // Created By
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Ledger")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const today = new Date().toISOString().slice(0, 10)
  const filename = `ledger-report-${today}.xlsx`

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
