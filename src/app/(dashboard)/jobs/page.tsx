import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { auth } from "@/lib/auth"
import { getJobs } from "@/lib/data/jobs"
import { canCreateJob, isRestrictedToAssignedJobs } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { T, TInput } from "@/components/ui/T"
import { Table } from "@/components/ui/table"
import { StatusBadge, PriorityBadge, EquipmentTypeIcon } from "@/components/ui/badge"
import { JOB_STATUS_LABELS, PRIORITY_LABELS } from "@/types"
import type { JobStatus, Priority, Role } from "@/types"
import { format } from "date-fns"

const JOB_STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[]
const PRIORITIES = Object.keys(PRIORITY_LABELS) as Priority[]

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; priority?: string }>
}) {
  const session = await auth()
  const { search = "", status, priority } = await searchParams
  const companyId = session!.user.companyId as string
  const role = session!.user.role as Role
  const userId = session!.user.id as string

  const validStatus =
    status && JOB_STATUSES.includes(status as JobStatus)
      ? (status as JobStatus)
      : undefined

  const validPriority =
    priority && PRIORITIES.includes(priority as Priority)
      ? (priority as Priority)
      : undefined

  const jobs = await getJobs(companyId, {
    search: search || undefined,
    status: validStatus,
    priority: validPriority,
    assignedToId: isRestrictedToAssignedJobs(role) ? userId : undefined,
  })

  return (
    <div>
      <PageHeader
        title={<T k="serviceJobs" />}
        subtitle={<>{jobs.length} <T k="jobs" /></>}
        actions={
          canCreateJob(role) ? (
            <Link href="/jobs/new">
              <Button icon={<Plus className="h-4 w-4" />}><T k="newJob" /></Button>
            </Link>
          ) : undefined
        }
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <TInput
            name="search"
            type="search"
            placeholderKey="searchJobsPlaceholder"
            defaultValue={search}
            className="pl-9"
          />
        </div>
        <Select name="status" defaultValue={status ?? ""} className="w-52">
          <option value=""><T k="allStatuses" /></option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Select name="priority" defaultValue={priority ?? ""} className="w-36">
          <option value=""><T k="allPriorities" /></option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {(search || status || priority) && (
          <Link href="/jobs">
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "jobNumber",
            label: <T k="jobNumber" />,
            render: (row) => (
              <Link href={`/jobs/${row.id}`} className="font-mono text-sm font-semibold text-blue-600 hover:underline whitespace-nowrap">
                {row.jobNumber}
              </Link>
            ),
          },
          {
            key: "customer",
            label: <T k="customer" />,
            render: (row) => (
              <Link href={`/customers/${row.customer.id}`} className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
                {row.customer.name}
              </Link>
            ),
          },
          {
            key: "equipment",
            label: <T k="equipment" />,
            render: (row) => (
              <div className="flex items-center gap-2">
                <EquipmentTypeIcon type={row.equipment.type} className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <Link href={`/equipment/${row.equipment.id}`} className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
                  {row.equipment.brand} {row.equipment.model}
                </Link>
              </div>
            ),
          },
          {
            key: "status",
            label: <T k="status" />,
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "priority",
            label: <T k="priority" />,
            render: (row) => <PriorityBadge priority={row.priority} />,
          },
          {
            key: "assignedTo",
            label: <T k="engineer" />,
            render: (row) => <span className="text-sm text-slate-600 whitespace-nowrap">{row.assignedTo.name}</span>,
          },
          {
            key: "receivedDate",
            label: <T k="received" />,
            render: (row) => (
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {format(new Date(row.receivedDate), "dd MMM yyyy")}
              </span>
            ),
          },
          {
            key: "dueDate",
            label: <T k="due" />,
            render: (row) => (
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {row.dueDate ? format(new Date(row.dueDate), "dd MMM yyyy") : "—"}
              </span>
            ),
          },
        ]}
        data={jobs}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noJobsFound" />}
        emptyDescription={
          search || status || priority
            ? <T k="tryAdjustingFilters" />
            : <T k="createFirstJob" />
        }
      />
    </div>
  )
}
