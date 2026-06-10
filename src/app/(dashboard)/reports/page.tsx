import { redirect } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import type { Role } from "@/types"

export default async function ReportsPage() {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "reports")) redirect("/dashboard")

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="View service performance, revenue, and operational reports."
      />
      <div className="rounded-xl border border-slate-200 bg-white">
        <EmptyState
          icon={<BarChart3 className="h-7 w-7" />}
          title="Reports coming in Phase 8"
          description="Generate PDF reports, view revenue trends, track SLA compliance, and analyse equipment failure rates."
        />
      </div>
    </div>
  )
}
