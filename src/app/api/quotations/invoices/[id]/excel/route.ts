import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getInvoiceForPdf } from "@/lib/data/invoices"
import { canAccess } from "@/lib/permissions"
import { generateInvoiceExcel, InvoiceExcelError } from "@/lib/invoiceExcel"
import type { Role } from "@/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "invoice", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id } = await params

  const invoice = await getInvoiceForPdf(id, companyId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  let outputPath: string
  try {
    outputPath = await generateInvoiceExcel(invoice)
  } catch (error) {
    if (error instanceof InvoiceExcelError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  const buffer = await readFile(outputPath)
  const fileName = `${invoice.invoiceNumber}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
