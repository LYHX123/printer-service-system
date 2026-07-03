import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getInvoice } from "@/lib/data/invoices"
import type { Role } from "@/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "quotations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id } = await params

  const invoice = await getInvoice(id, companyId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const currency = invoice.company.currency
  const subtotal = Number(invoice.subtotal)
  const vatPercent = Number(invoice.vatPercent)
  const vatAmount = Number(invoice.vatAmount)
  const totalAmount = Number(invoice.totalAmount)

  const rows: (string | number)[][] = []

  rows.push([invoice.company.name])
  if (invoice.company.address) rows.push([invoice.company.address])
  if (invoice.company.kraPin) rows.push([`PIN: ${invoice.company.kraPin}`])
  rows.push([])
  rows.push(["INVOICE"])
  rows.push([])

  const customerHeaderRow = rows.length
  rows.push(["Customer:", invoice.customer.companyName, "", "", "Date:", format(new Date(invoice.date), "yyyy-MM-dd")])
  rows.push(["PIN:", invoice.customerPin || invoice.customer.pinNumber || "—", "", "", "Invoice No.:", invoice.invoiceNumber])
  rows.push([])

  rows.push(["Description", "Unit", "Qty", `Unit Price (${currency})`, `Amount (${currency})`])
  for (const item of invoice.items) {
    rows.push([
      item.description,
      item.unit ?? "",
      item.quantity,
      Number(item.unitPrice),
      Number(item.amount),
    ])
  }
  rows.push([])

  rows.push(["", "", "", "Subtotal", subtotal])
  rows.push(["", "", "", `VAT (${vatPercent}%)`, vatAmount])
  rows.push(["", "", "", "TOTAL", totalAmount])
  rows.push([])
  rows.push([])
  rows.push(["Received By:", "_________________________"])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [
    { wch: 32 }, // Description / Customer / labels
    { wch: 14 }, // Unit / value
    { wch: 10 }, // Qty
    { wch: 18 }, // Unit Price
    { wch: 18 }, // Amount
  ]
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } },
    { s: { r: customerHeaderRow, c: 1 }, e: { r: customerHeaderRow, c: 3 } },
    { s: { r: customerHeaderRow + 1, c: 1 }, e: { r: customerHeaderRow + 1, c: 3 } },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Invoice")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const filename = `${invoice.invoiceNumber}.xlsx`

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
