import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, User, Wrench, MapPin, ShieldCheck, Phone, Gauge, Image as ImageIcon, PenTool, FileText } from "lucide-react"
import { auth } from "@/lib/auth"
import { canUpdateJobStatus } from "@/lib/permissions"
import { getJob, getEngineers } from "@/lib/data/jobs"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { StatusBadge, PriorityBadge, EquipmentTypeBadge, WarrantyBadge } from "@/components/ui/badge"
import { SERVICE_TYPE_LABELS } from "@/types"
import type { Role } from "@/types"
import { StatusTimeline } from "@/components/jobs/StatusTimeline"
import { TechnicianNotesForm } from "@/components/jobs/TechnicianNotesForm"
import { JobActions } from "@/components/jobs/JobActions"
import { format } from "date-fns"
import { T } from "@/components/ui/T"

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params
  const companyId = session!.user.companyId as string
  const userRole = session!.user.role as string
  const userId = session!.user.id as string

  const [job, engineers] = await Promise.all([
    getJob(id, companyId),
    getEngineers(companyId),
  ])

  if (!job) notFound()
  if (userRole === "ENGINEER" && job.assignedTo.id !== userId) notFound()

  const canUpdateStatus = canUpdateJobStatus(userRole as Role)
  const canAssign = true
  const isFinal = job.status === "DELIVERED" || job.status === "CANCELLED"
  const showMeter = job.equipment.type === "PRINTER" || job.equipment.type === "COPIER"

  return (
    <div>
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="jobs" />
      </Link>

      <PageHeader
        title={job.jobNumber}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={job.status} />
            <PriorityBadge priority={job.priority} />
            <span className="text-sm text-slate-500">{SERVICE_TYPE_LABELS[job.serviceType]}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/jobs/${id}/photos`}>
              <Button variant="outline" size="sm" icon={<ImageIcon className="h-3.5 w-3.5" />}>
                <T k="photos" />
              </Button>
            </Link>
            <Link href={`/jobs/${id}/signature`}>
              <Button variant="outline" size="sm" icon={<PenTool className="h-3.5 w-3.5" />}>
                <T k="signature" />
              </Button>
            </Link>
            <Link href={`/jobs/${id}/report`}>
              <Button variant="outline" size="sm" icon={<FileText className="h-3.5 w-3.5" />}>
                <T k="repairReport" />
              </Button>
            </Link>
            <JobActions
              jobId={id}
              currentStatus={job.status}
              currentAssigneeId={job.assignedTo.id}
              engineers={engineers}
              canUpdateStatus={canUpdateStatus && !isFinal}
              canAssign={canAssign}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-4">
          {/* Equipment */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="equipment" /></h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <EquipmentTypeBadge type={job.equipment.type} />
              </div>
              <Link href={`/equipment/${job.equipment.id}`} className="block text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {job.equipment.brand} {job.equipment.model}
              </Link>
              <p className="font-mono text-xs text-slate-400">{job.equipment.serialNumber}</p>
              {job.equipment.warrantyExpiry && (
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                  <T k="warrantyTo" /> {format(new Date(job.equipment.warrantyExpiry), "dd MMM yyyy")}
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="customer" /></h3>
            <div className="space-y-2">
              <Link href={`/customers/${job.customer.id}/edit`} className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {job.customer.companyName}
              </Link>
              {job.customer.name && (
                <p className="text-xs text-slate-500">{job.customer.name}</p>
              )}
              {job.customer.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {job.customer.phone}
                </div>
              )}
              {job.branch && (
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {job.branch.name}
                </div>
              )}
            </div>
          </div>

          {/* Job meta */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="jobDetails" /></h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-400"><T k="assignedTo" /></dt>
                  <dd>{job.assignedTo.name}</dd>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Wrench className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-400"><T k="received" /></dt>
                  <dd>{format(new Date(job.receivedDate), "dd MMM yyyy")}</dd>
                </div>
              </div>
              {job.dueDate && (
                <div className="text-slate-600 ml-6">
                  <dt className="text-xs text-slate-400"><T k="due" /></dt>
                  <dd>{format(new Date(job.dueDate), "dd MMM yyyy")}</dd>
                </div>
              )}
              {job.completedAt && (
                <div className="text-slate-600 ml-6">
                  <dt className="text-xs text-slate-400"><T k="completed" /></dt>
                  <dd>{format(new Date(job.completedAt), "dd MMM yyyy")}</dd>
                </div>
              )}
              {job.completedAt && (
                <div className="text-slate-600 ml-6">
                  <dt className="text-xs text-slate-400 mb-1"><T k="warranty" /></dt>
                  <dd><WarrantyBadge warrantyExpires={job.warrantyExpires} /></dd>
                </div>
              )}
              <div className="text-slate-600 ml-6">
                <dt className="text-xs text-slate-400"><T k="createdBy" /></dt>
                <dd>{job.createdBy.name}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right: main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Problem description */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="problemDescription" /></h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{job.problemDesc}</p>
            {job.internalNotes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1"><T k="internalNotes" /></p>
                <p className="text-sm text-slate-600 italic whitespace-pre-line">{job.internalNotes}</p>
              </div>
            )}
          </div>

          {/* Meter readings */}
          {showMeter && job.meterReadings.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-slate-400" />
                <T k="meterReadings" />
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                      <th className="pb-2 text-left"><T k="date" /></th>
                      <th className="pb-2 text-right"><T k="black" /></th>
                      <th className="pb-2 text-right"><T k="colour" /></th>
                      <th className="pb-2 text-left pl-4"><T k="recordedBy" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {job.meterReadings.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 text-xs text-slate-500">
                          {format(new Date(r.readingDate), "dd MMM yyyy")}
                        </td>
                        <td className="py-2 text-right font-mono">{r.blackPages?.toLocaleString() ?? "—"}</td>
                        <td className="py-2 text-right font-mono">{r.colorPages?.toLocaleString() ?? "—"}</td>
                        <td className="py-2 pl-4 text-xs text-slate-500">{r.recordedBy.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Technician notes */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="technicianNotes" /></h3>
            <TechnicianNotesForm
              jobId={id}
              currentNotes={job.technicianNotes}
              equipmentType={job.equipment.type}
            />
          </div>

          {/* Status timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="statusHistory" /></h3>
            <StatusTimeline logs={job.statusLogs} />
          </div>
        </div>
      </div>
    </div>
  )
}
