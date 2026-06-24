import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { auth } from "@/lib/auth"
import { getCustomers } from "@/lib/data/customers"
import { getCompanySettings } from "@/lib/data/settings"
import { canAccess } from "@/lib/permissions"
import { CustomerSummaryDocument } from "@/components/pdf/CustomerSummaryDocument"
import type { Role } from "@/types"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "customers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const [customers, company] = await Promise.all([
    getCustomers(companyId),
    getCompanySettings(companyId),
  ])
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  const buffer = await renderToBuffer(<CustomerSummaryDocument customers={customers} company={company} />)
  const fileName = `Customer-Summary-Report-${new Date().toISOString().slice(0, 10)}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
