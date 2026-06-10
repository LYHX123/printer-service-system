import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { getJobForReport } from "@/lib/data/reports"
import { getSparePartOptions } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { WarrantyBadge } from "@/components/ui/badge"
import { RepairReportForm } from "@/components/jobs/RepairReportForm"
import { ReportActions } from "@/components/jobs/ReportActions"
import { formatCurrency } from "@/lib/utils"
import { EQUIPMENT_TYPE_LABELS, SERVICE_TYPE_LABELS } from "@/types"

export default async function JobReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params
  const companyId = session!.user.companyId as string

  const [job, spareParts] = await Promise.all([
    getJobForReport(id, companyId),
    getSparePartOptions(companyId),
  ])
  if (!job) notFound()

  const showMeter = job.equipment.type === "PRINTER" || job.equipment.type === "COPIER"
  const beforePhotos = job.photos.filter((p) => p.photoType === "BEFORE")
  const afterPhotos = job.photos.filter((p) => p.photoType === "AFTER")

  return (
    <div>
      <Link href={`/jobs/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 print:hidden">
        <ChevronLeft className="h-4 w-4" />
        {job.jobNumber}
      </Link>

      <PageHeader
        title="Repair Report"
        subtitle={job.jobNumber}
        actions={<ReportActions jobId={id} />}
      />

      <div className="space-y-4">
        {/* Report meta */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span>
            Job Number: <span className="font-mono font-semibold text-slate-900">{job.jobNumber}</span>
          </span>
          <span>
            Generated on: <span className="font-medium text-slate-900">{format(new Date(), "dd MMM yyyy, HH:mm")}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Customer information */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Customer Information</h3>
            <dl className="space-y-1.5 text-sm text-slate-600">
              <div className="flex justify-between"><dt>Name</dt><dd className="font-medium text-slate-900">{job.customer.name}</dd></div>
              {job.customer.companyName && (
                <div className="flex justify-between"><dt>Company</dt><dd>{job.customer.companyName}</dd></div>
              )}
              {job.customer.phone && (
                <div className="flex justify-between"><dt>Phone</dt><dd>{job.customer.phone}</dd></div>
              )}
              {job.customer.email && (
                <div className="flex justify-between"><dt>Email</dt><dd>{job.customer.email}</dd></div>
              )}
              {job.branch && (
                <div className="flex justify-between"><dt>Branch / Site</dt><dd>{job.branch.name}</dd></div>
              )}
            </dl>
          </div>

          {/* Equipment information */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Equipment Information</h3>
            <dl className="space-y-1.5 text-sm text-slate-600">
              <div className="flex justify-between"><dt>Type</dt><dd>{EQUIPMENT_TYPE_LABELS[job.equipment.type]}</dd></div>
              <div className="flex justify-between"><dt>Brand / Model</dt><dd className="font-medium text-slate-900">{job.equipment.brand} {job.equipment.model}</dd></div>
              <div className="flex justify-between"><dt>Serial Number</dt><dd className="font-mono">{job.equipment.serialNumber}</dd></div>
              <div className="flex justify-between"><dt>Asset Number</dt><dd className="font-mono">{job.equipment.assetNumber ?? "—"}</dd></div>
              <div className="flex justify-between"><dt>Service Type</dt><dd>{SERVICE_TYPE_LABELS[job.serviceType]}</dd></div>
              <div className="flex justify-between"><dt>Received</dt><dd>{format(new Date(job.receivedDate), "dd MMM yyyy")}</dd></div>
              {job.completedAt && (
                <div className="flex justify-between"><dt>Completed</dt><dd>{format(new Date(job.completedAt), "dd MMM yyyy")}</dd></div>
              )}
            </dl>
          </div>
        </div>

        {/* Problem reported */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Problem Reported</h3>
          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{job.problemDesc}</p>
        </div>

        {/* Meter readings */}
        {showMeter && job.meterReadings.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Meter Readings</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                    <th className="pb-2 text-left">Date</th>
                    <th className="pb-2 text-right">Black</th>
                    <th className="pb-2 text-right">Colour</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {job.meterReadings.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 text-xs text-slate-500">{format(new Date(r.readingDate), "dd MMM yyyy")}</td>
                      <td className="py-2 text-right font-mono">{r.blackPages?.toLocaleString() ?? "—"}</td>
                      <td className="py-2 text-right font-mono">{r.colorPages?.toLocaleString() ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Technician notes */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Technician Notes</h3>
          {job.technicianNotes ? (
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{job.technicianNotes}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">No technician notes recorded.</p>
          )}
        </div>

        {/* Repair report form (diagnosis, work done, recommendations, parts, labour) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 print:hidden">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Repair Details</h3>
          <RepairReportForm
            jobId={id}
            spareParts={spareParts}
            defaultValues={
              job.report
                ? {
                    diagnosis: job.report.diagnosis,
                    workDone: job.report.workDone,
                    recommendations: job.report.recommendations ?? "",
                    labourCost: Number(job.report.labourCost),
                    parts: job.report.parts.map((p) => ({
                      partId: p.partId ?? "",
                      partName: p.partName,
                      quantity: p.quantity,
                      unitPrice: Number(p.unitPrice),
                    })),
                  }
                : undefined
            }
          />
        </div>

        {/* Print-only repair details (read-only) */}
        <div className="hidden print:block rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Repair Details</h3>
          {job.report ? (
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Diagnosis</p>
                <p className="whitespace-pre-line">{job.report.diagnosis}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Work Performed</p>
                <p className="whitespace-pre-line">{job.report.workDone}</p>
              </div>
              {job.report.recommendations && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Recommendations</p>
                  <p className="whitespace-pre-line">{job.report.recommendations}</p>
                </div>
              )}
              {job.report.parts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Spare Parts Replaced</p>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                        <th className="pb-2 text-left">Part</th>
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">Unit Price</th>
                        <th className="pb-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {job.report.parts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2">
                            {p.partName}
                            {!p.partId && (
                              <span className="block text-xs text-amber-600">
                                Not linked to inventory — stock not deducted
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right">{p.quantity}</td>
                          <td className="py-2 text-right">{formatCurrency(Number(p.unitPrice))}</td>
                          <td className="py-2 text-right">{formatCurrency(Number(p.subtotal))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="ml-auto max-w-xs space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between"><span>Labour</span><span>{formatCurrency(Number(job.labourCost))}</span></div>
                <div className="flex justify-between"><span>Parts</span><span>{formatCurrency(Number(job.partsCost))}</span></div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5"><span>Total</span><span>{formatCurrency(Number(job.totalCost))}</span></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No repair report recorded yet.</p>
          )}
        </div>

        {/* Warranty information */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Warranty Information</h3>
          {job.completedAt ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <WarrantyBadge warrantyExpires={job.warrantyExpires} />
              {job.warrantyPeriod && <span>Period: {job.warrantyPeriod} days</span>}
              {job.warrantyExpires && <span>Expires: {format(new Date(job.warrantyExpires), "dd MMM yyyy")}</span>}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Warranty will be set when the job is marked Delivered.</p>
          )}
        </div>

        {/* Photos */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Before Photos</h3>
            {beforePhotos.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No before photos uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {beforePhotos.map((p) => (
                  <img key={p.id} src={p.fileUrl} alt={p.caption ?? "Before"} className="aspect-square w-full rounded-lg object-cover border border-slate-200" />
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">After Photos</h3>
            {afterPhotos.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No after photos uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {afterPhotos.map((p) => (
                  <img key={p.id} src={p.fileUrl} alt={p.caption ?? "After"} className="aspect-square w-full rounded-lg object-cover border border-slate-200" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Customer Signature</h3>
            {job.signatureUrl ? (
              <div className="space-y-2">
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                  <img src={job.signatureUrl} alt="Customer signature" className="mx-auto max-h-32" />
                </div>
                {job.signedAt && (
                  <p className="text-xs text-slate-500">Signed on {format(new Date(job.signedAt), "dd MMM yyyy, HH:mm")}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No customer signature captured yet.</p>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Engineer Sign-Off</h3>
            <div className="space-y-2">
              {job.assignedTo.signatureUrl ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                  <img src={job.assignedTo.signatureUrl} alt="Engineer signature" className="mx-auto max-h-32" />
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400 italic">
                  No signature on file
                </div>
              )}
              <p className="text-sm text-slate-700 font-medium">{job.assignedTo.name}</p>
              {job.completedAt && (
                <p className="text-xs text-slate-500">Completed on {format(new Date(job.completedAt), "dd MMM yyyy")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
