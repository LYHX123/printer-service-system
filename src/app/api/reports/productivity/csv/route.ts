import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canAccess, canViewAllProductivity } from "@/lib/permissions"
import { getEngineerProductivity } from "@/lib/data/analytics"
import { toCsv, csvResponse } from "@/lib/csv"
import { ROLE_LABELS } from "@/types"
import type { Role } from "@/types"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = session.user.role as Role
  if (!canAccess(role, "productivity")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string
  const canViewAll = canViewAllProductivity(role)

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const engineerId = canViewAll ? (searchParams.get("engineerId") ?? undefined) : userId

  const rows = await getEngineerProductivity(companyId, { from, to, engineerId })

  const csv = toCsv(
    ["Engineer", "Role", "Jobs Assigned", "Jobs Completed", "Avg Completion (days)", "Revenue Generated", "Parts Used"],
    rows.map((r) => [
      r.engineer.name,
      ROLE_LABELS[r.engineer.role],
      r.jobsAssigned,
      r.jobsCompleted,
      r.avgCompletionDays !== null ? r.avgCompletionDays.toFixed(1) : "",
      r.revenueGenerated.toFixed(2),
      r.partsUsed,
    ])
  )

  return csvResponse(csv, "engineer-productivity.csv")
}
