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
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user.name?.split(" ")[0] ?? "there"

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
          value="—"
          href="/inventory"
          icon={<Wrench className="h-5 w-5 text-slate-600" />}
          iconBg="bg-slate-100"
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

        {/* Status breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Jobs by Status</h2>
            <p className="text-xs text-slate-500 mt-0.5">Current distribution</p>
          </div>
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="text-center">
              <div className="h-8 w-8 mx-auto mb-2 opacity-40 rounded-full border-4 border-current" />
              <p className="text-sm">Chart available from Phase 8</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
