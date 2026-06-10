import Link from "next/link"
import { redirect } from "next/navigation"
import { Download, TrendingUp } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess, canViewAllProductivity } from "@/lib/permissions"
import { getEngineerProductivity } from "@/lib/data/analytics"
import { getEngineers } from "@/lib/data/jobs"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RoleBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import type { Role } from "@/types"

interface ProductivitySearchParams {
  from?: string
  to?: string
  engineerId?: string
}

export default async function EngineerProductivityPage({
  searchParams,
}: {
  searchParams: Promise<ProductivitySearchParams>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  if (!canAccess(role, "productivity")) redirect("/dashboard")
  const companyId = session!.user.companyId as string
  const userId = session!.user.id as string

  const { from, to, engineerId: requestedEngineerId } = await searchParams
  const canViewAll = canViewAllProductivity(role)

  // Engineers can only ever view their own productivity.
  const engineerId = canViewAll ? requestedEngineerId : userId

  const [rows, engineers] = await Promise.all([
    getEngineerProductivity(companyId, { from, to, engineerId }),
    canViewAll ? getEngineers(companyId) : Promise.resolve([]),
  ])

  const csvParams = new URLSearchParams()
  if (from) csvParams.set("from", from)
  if (to) csvParams.set("to", to)
  if (engineerId) csvParams.set("engineerId", engineerId)

  const totalJobsCompleted = rows.reduce((sum, r) => sum + r.jobsCompleted, 0)
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenueGenerated, 0)
  const totalPartsUsed = rows.reduce((sum, r) => sum + r.partsUsed, 0)

  return (
    <div>
      <PageHeader
        title="Engineer Productivity"
        subtitle="Track jobs completed, average completion time, revenue, and parts used per engineer."
      />

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Jobs Completed" value={totalJobsCompleted} icon={<TrendingUp className="h-5 w-5 text-green-600" />} iconBg="bg-green-50" />
          <MetricCard label="Revenue Generated" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="h-5 w-5 text-blue-600" />} />
          <MetricCard label="Parts Used" value={totalPartsUsed} icon={<TrendingUp className="h-5 w-5 text-indigo-600" />} iconBg="bg-indigo-50" />
        </div>

        <form method="GET" className="flex flex-wrap gap-2">
          <Input name="from" type="date" defaultValue={from ?? ""} className="w-44" aria-label="From date" />
          <Input name="to" type="date" defaultValue={to ?? ""} className="w-44" aria-label="To date" />
          {canViewAll && (
            <Select name="engineerId" defaultValue={engineerId ?? ""} className="w-52">
              <option value="">All Engineers</option>
              {engineers.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          )}
          <Button type="submit" variant="secondary">Filter</Button>
          {(from || to || (canViewAll && engineerId)) && (
            <Link href="/reports/engineers">
              <Button variant="ghost">Clear</Button>
            </Link>
          )}
          <a href={`/api/reports/productivity/csv?${csvParams.toString()}`}>
            <Button type="button" variant="outline" icon={<Download className="h-3.5 w-3.5" />}>
              Export CSV
            </Button>
          </a>
        </form>

        <Table
          columns={[
            {
              key: "engineer",
              label: "Engineer",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{row.engineer.name}</span>
                  <RoleBadge role={row.engineer.role} />
                </div>
              ),
            },
            {
              key: "jobsAssigned", label: "Jobs Assigned", className: "text-right", headerClassName: "text-right",
              render: (row) => <span className="font-mono">{row.jobsAssigned}</span>,
            },
            {
              key: "jobsCompleted", label: "Jobs Completed", className: "text-right", headerClassName: "text-right",
              render: (row) => <span className="font-mono">{row.jobsCompleted}</span>,
            },
            {
              key: "avgCompletionDays", label: "Avg. Completion Time", className: "text-right", headerClassName: "text-right",
              render: (row) => (
                <span className="font-mono">
                  {row.avgCompletionDays !== null ? `${row.avgCompletionDays.toFixed(1)} days` : "—"}
                </span>
              ),
            },
            {
              key: "revenueGenerated", label: "Revenue Generated", className: "text-right", headerClassName: "text-right",
              render: (row) => <span className="font-medium">{formatCurrency(row.revenueGenerated)}</span>,
            },
            {
              key: "partsUsed", label: "Parts Used", className: "text-right", headerClassName: "text-right",
              render: (row) => <span className="font-mono">{row.partsUsed}</span>,
            },
          ]}
          data={rows}
          keyExtractor={(row) => row.engineer.id}
          emptyTitle="No productivity data found"
          emptyDescription="Try adjusting your filters."
        />
      </div>
    </div>
  )
}
