import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canExportLedgerBook } from "@/lib/permissions"
import { getShopAccountEntries } from "@/lib/data/shopAccount"
import type { LedgerEntryType, LedgerPaymentMethod, Role } from "@/types"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MPESA: "M-Pesa",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  CASH: "Cash",
  CARD: "Card",
  OTHER: "Other",
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canExportLedgerBook(session.user.role as Role, session.user.modulePermissions, "shop")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const typeParam = searchParams.get("type") ?? undefined
  const categoryId = searchParams.get("categoryId") ?? undefined
  const paymentMethodParam = searchParams.get("paymentMethod") ?? undefined
  const createdById = searchParams.get("createdById") ?? undefined
  const search = searchParams.get("search") ?? undefined

  const VALID_TYPES: LedgerEntryType[] = ["INCOME", "EXPENSE"]
  const validType = VALID_TYPES.includes(typeParam as LedgerEntryType) ? (typeParam as LedgerEntryType) : undefined
  const VALID_METHODS: LedgerPaymentMethod[] = ["MPESA", "BANK_TRANSFER", "CHEQUE", "CASH", "CARD", "OTHER"]
  const validMethod = VALID_METHODS.includes(paymentMethodParam as LedgerPaymentMethod)
    ? (paymentMethodParam as LedgerPaymentMethod)
    : undefined

  const entries = await getShopAccountEntries(companyId, {
    from,
    to,
    type: validType,
    categoryId,
    paymentMethod: validMethod,
    createdById,
    search,
  })

  let totalIncome = 0
  let totalExpense = 0
  for (const e of entries) {
    if (e.type === "INCOME") totalIncome += e.amount
    else totalExpense += e.amount
  }
  const balance = totalIncome - totalExpense

  const header = ["Date", "Type", "Category", "Description", "Supplier / Payee", "Amount", "Payment Method", "Created By", "Remarks"]

  const dataRows = entries.map((e) => [
    format(new Date(e.date), "dd MMM yyyy"),
    e.type === "INCOME" ? "Income" : "Expense",
    e.category.name,
    e.description,
    e.payee ?? "",
    e.amount,
    PAYMENT_METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod,
    e.createdBy.name,
    e.remarks ?? "",
  ])

  const summaryRows = [
    [],
    ["Total Income", "", "", "", "", totalIncome, "", "", ""],
    ["Total Expense", "", "", "", "", totalExpense, "", "", ""],
    ["Balance", "", "", "", "", balance, "", "", ""],
  ]

  const allRows = [header, ...dataRows, ...summaryRows]
  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws["!cols"] = [
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 30 },
    { wch: 20 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 30 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Shop Account")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const today = new Date().toISOString().slice(0, 10)
  const filename = `shop-account-${today}.xlsx`

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
