import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { auth } from "@/lib/auth"
import { getStockMovements } from "@/lib/data/inventory"
import { getCompanySettings } from "@/lib/data/settings"
import { canAccess } from "@/lib/permissions"
import { StockMovementDocument } from "@/components/pdf/StockMovementDocument"
import { CATEGORIES_FOR_STOCK_TYPE, isStockType } from "@/lib/stock-types"
import { TRANSACTION_TYPE_LABELS } from "@/types"
import type { TransactionType, Role } from "@/types"

const TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "inventory")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category") ?? undefined
  const type = searchParams.get("type") ?? undefined
  const search = searchParams.get("search") ?? undefined
  const date = searchParams.get("date") ?? undefined

  const stockType = isStockType(category) ? category : undefined
  const validType = TRANSACTION_TYPES.includes(type as TransactionType) ? (type as TransactionType) : undefined
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined

  const [movements, company] = await Promise.all([
    getStockMovements(companyId, {
      type: validType,
      from: validDate,
      to: validDate,
      search,
      categories: stockType ? CATEGORIES_FOR_STOCK_TYPE[stockType] : undefined,
    }),
    getCompanySettings(companyId),
  ])
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  const buffer = await renderToBuffer(<StockMovementDocument movements={movements} company={company} />)
  const fileName = `Stock-Movement-Report-${new Date().toISOString().slice(0, 10)}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
