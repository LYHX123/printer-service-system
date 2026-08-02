import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getUnpaidSalesLedgerEntriesForCustomer } from "@/lib/data/ledger"
import type { Role } from "@/types"

/** Feeds the "Apply to Sales Records" allocation panel on the Ledger Income form — a customer's UNPAID/PARTIAL Sales Ledger invoices. */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "ledger", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const companyId = session.user.companyId as string
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get("customerId")?.trim() ?? ""

  if (!customerId) return NextResponse.json({ entries: [] })

  const entries = await getUnpaidSalesLedgerEntriesForCustomer(customerId, companyId)
  return NextResponse.json({ entries })
}
