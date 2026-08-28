import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canAccess, canViewStock } from "@/lib/permissions"
import { getSpareParts } from "@/lib/data/inventory"
import { CATEGORIES_FOR_STOCK_TYPE, isStockType, stockTypeToBucket } from "@/lib/stock-types"
import { generateStockExcel, stockExcelFileName } from "@/lib/stockExcel/generate"
import type { Role } from "@/types"

/**
 * Stock management Excel export, one Stock Type per request (?type=EQUIPMENT|
 * CONSUMPTION|PARTS|COMMON_PRODUCT). Exports every Active row of that Stock Type
 * for the caller's own company — search/filter query params are intentionally
 * ignored so "Export Excel" always yields the full sub-module. Read-only.
 *
 * Tenant isolation and permissions reuse the existing Stock model: the caller
 * must have inventory access AND view permission on the requested Stock Type's
 * bucket, and rows are always scoped to session.companyId.
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = session.user.role as Role
  const permissions = session.user.modulePermissions

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") ?? undefined
  if (!isStockType(type)) {
    return NextResponse.json({ error: "Unknown stock type" }, { status: 400 })
  }

  if (
    !canAccess(role, "inventory", permissions) ||
    !canViewStock(role, permissions, stockTypeToBucket(type))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const companyId = session.user.companyId as string

  const parts = await getSpareParts(companyId, {
    categories: CATEGORIES_FOR_STOCK_TYPE[type],
  })

  const buffer = await generateStockExcel(type, parts)
  const fileName = stockExcelFileName(type)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
