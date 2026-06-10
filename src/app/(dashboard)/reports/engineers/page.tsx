import { redirect } from "next/navigation"
import { TrendingUp } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import type { Role } from "@/types"

export default async function EngineerProductivityPage() {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "reports")) redirect("/dashboard")

  return (
    <div>
      <PageHeader
        title="Engineer Productivity"
        subtitle="Track jobs completed, response times, and performance metrics per engineer."
      />
      <div className="rounded-xl border border-slate-200 bg-white">
        <EmptyState
          icon={<TrendingUp className="h-7 w-7" />}
          title="Productivity dashboard coming in Phase 8"
          description="View job completion rates, average repair times, customer satisfaction scores, and monthly targets per engineer."
        />
      </div>
    </div>
  )
}
