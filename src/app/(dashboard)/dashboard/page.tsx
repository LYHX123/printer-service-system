import Link from "next/link"
import { auth } from "@/lib/auth"
import {
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Users,
  HardDrive,
  Wrench,
  FileText,
  PackageX,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"
import { StockLevelBadge } from "@/components/ui/badge"
import { canAccess } from "@/lib/permissions"
import { getLowStockCount, getLowStockParts, getStockLevel } from "@/lib/data/inventory"
import type { Role } from "@/types"

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user.name?.split(" ")[0] ?? "there"
  const role = session!.user.role as Role
  const companyId = session!.user.companyId as string
  const canViewInventory = canAccess(role, "inventory")

  const lowStockCount = canViewInventory ? await getLowStockCount(companyId) : 0
  const lowStockParts = canViewInventory ? await getLowStockParts(companyId) : []

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's what's happening in your service centre today."
      />

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Open Jobs"
          value="—"
          href="/jobs"
          icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <MetricCard
          label="Completed Today"
          value="—"
          href="/jobs"
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
        />
        <MetricCard
          label="Overdue"
          value="—"
          href="/jobs"
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
        />
        <MetricCard
          label="Revenue (MTD)"
          value="—"
          icon={<DollarSign className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50"
        />
      </div>

      {/* Secondary metrics */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Active Customers"
          value="—"
          href="/customers"
          icon={<Users className="h-5 w-5 text-slate-600" />}
          iconBg="bg-slate-100"
        />
        <MetricCard
          label="Equipment Registered"
          value="—"
          href="/equipment"
          icon={<HardDrive className="h-5 w-5 text-slate-600" />}
          iconBg="bg-slate-100"
        />
        <MetricCard
          label="Pending Quotations"
          value="—"
          href="/quotations"
          icon={<FileText className="h-5 w-5 text-slate-600" />}
          iconBg="bg-slate-100"
        />
        <MetricCard
          label="Parts Low Stock"
          value={canViewInventory ? lowStockCount : "—"}
          href="/stock"
          icon={<Wrench className="h-5 w-5 text-slate-600" />}
          iconBg={lowStockCount > 0 ? "bg-orange-50" : "bg-slate-100"}
        />
      </div>

      {/* Placeholder panels */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent jobs */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent Jobs</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest 10 service jobs</p>
          </div>
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="text-center">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Live data available from Phase 3</p>
            </div>
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Low Stock Alerts</h2>
            <p className="text-xs text-slate-500 mt-0.5">Parts at or below minimum quantity</p>
          </div>
          {!canViewInventory ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="text-center">
                <PackageX className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No access to inventory</p>
              </div>
            </div>
          ) : lowStockParts.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">All parts are well stocked</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {lowStockParts.slice(0, 8).map((part) => {
                const quantity = part.stock?.quantity ?? 0
                return (
                  <li key={part.id} className="px-5 py-3">
                    <Link href={`/stock/${part.id}`} className="flex items-center justify-between gap-2 group">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">{part.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{part.partNumber}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono text-slate-500">{quantity}/{part.reorderLevel} {part.unit}</span>
                        <StockLevelBadge level={getStockLevel(quantity, part.reorderLevel)} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {lowStockParts.length > 8 && (
            <div className="border-t border-slate-100 px-5 py-3 text-center">
              <Link href="/stock/reports?tab=low-stock" className="text-xs font-medium text-blue-600 hover:underline">
                View all {lowStockParts.length} low stock parts →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
