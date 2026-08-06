import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { auth } from "@/lib/auth"
import { getStockMovements } from "@/lib/data/inventory"
import { getCompanySettings } from "@/lib/data/settings"
import { getViewableStockBuckets } from "@/lib/permissions"
import { StockMovementDocument } from "@/components/pdf/StockMovementDocument"
import { STOCK_TYPES, CATEGORIES_FOR_STOCK_TYPE, isStockType, stockTypeToBucket } from "@/lib/stock-types"
import { TRANSACTION_TYPE_LABELS } from "@/types"
import type { TransactionType, Role } from "@/types"

const TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = session.user.role as Role
  const permissions = session.user.modulePermissions
  const companyId = session.user.companyId as string

  // Same source of truth as /stock/movements/page.tsx — a stock.equipment.view-only
  // user must never get Consumption/Parts movements out of this export either.
  const viewableBuckets = getViewableStockBuckets(role, permissions)
  const viewableTypes = STOCK_TYPES.filter((st) => viewableBuckets.includes(stockTypeToBucket(st)))
  if (viewableTypes.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category") ?? undefined
  const type = searchParams.get("type") ?? undefined
  const search = searchParams.get("search") ?? undefined
  const date = searchParams.get("date") ?? undefined

  // Unlike the page (which silently falls back to the caller's viewable
  // buckets on an unauthorized/invalid category), an explicit category this
  // caller isn't allowed to view — or that isn't a real stock type at all —
  // is rejected outright here rather than substituted.
  const requestedType = category !== undefined ? (isStockType(category) ? category : undefined) : undefined
  if (category !== undefined && (!requestedType || !viewableTypes.includes(requestedType))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const validType = TRANSACTION_TYPES.includes(type as TransactionType) ? (type as TransactionType) : undefined
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined

  const [movements, company] = await Promise.all([
    getStockMovements(companyId, {
      type: validType,
      from: validDate,
      to: validDate,
      search,
      categories: requestedType
        ? CATEGORIES_FOR_STOCK_TYPE[requestedType]
        : viewableTypes.flatMap((st) => CATEGORIES_FOR_STOCK_TYPE[st]),
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
