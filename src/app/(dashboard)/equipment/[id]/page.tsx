import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Plus, Pencil, Hash, Calendar, ShieldCheck, User, MapPin, Gauge, FileText } from "lucide-react"
import { auth } from "@/lib/auth"
import { getEquipment } from "@/lib/data/equipment"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { EquipmentTypeBadge, StatusBadge, PriorityBadge, QuotationStatusBadge, WarrantyBadge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency } from "@/lib/utils"
import { SERVICE_TYPE_LABELS } from "@/types"
import { format } from "date-fns"
import { T } from "@/components/ui/T"

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params
  const companyId = session!.user.companyId as string

  const equipment = await getEquipment(id, companyId)
  if (!equipment) notFound()

  const showMeter = equipment.type === "PRINTER" || equipment.type === "COPIER"

  return (
    <div>
      <Link href="/equipment" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="equipment" />
      </Link>

      <PageHeader
        title={`${equipment.brand} ${equipment.model}`}
        subtitle={
          <span className="flex items-center gap-2">
            <EquipmentTypeBadge type={equipment.type} />
            <span className="font-mono text-xs text-slate-400">{equipment.serialNumber}</span>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Link href={`/jobs/new?customerId=${equipment.customerId}&equipmentId=${equipment.id}`}>
              <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                <T k="newJob" />
              </Button>
            </Link>
            <Link href={`/equipment/${id}/edit`}>
              <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
                <T k="edit" />
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Details column */}
        <div className="space-y-4">
          {/* Specs */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="deviceDetails" /></h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Hash className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-400"><T k="serialNumber" /></dt>
                  <dd className="font-mono font-semibold">{equipment.serialNumber}</dd>
                </div>
              </div>
              {equipment.assetNumber && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Hash className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-400"><T k="assetNumber" /></dt>
                    <dd className="font-mono">{equipment.assetNumber}</dd>
                  </div>
                </div>
              )}
              {equipment.purchaseDate && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-400"><T k="purchaseDate" /></dt>
                    <dd>{format(new Date(equipment.purchaseDate), "dd MMM yyyy")}</dd>
                  </div>
                </div>
              )}
              {equipment.warrantyExpiry && (
                <div className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-400"><T k="warrantyExpiry" /></dt>
                    <dd>{format(new Date(equipment.warrantyExpiry), "dd MMM yyyy")}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          {/* Customer */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="owner" /></h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <Link href={`/customers/${equipment.customer.id}`} className="text-slate-900 hover:text-blue-600 font-medium transition-colors">
                  {equipment.customer.name}
                </Link>
              </div>
              {equipment.customer.companyName && (
                <p className="ml-6 text-xs text-slate-500">{equipment.customer.companyName}</p>
              )}
              {equipment.customer.phone && (
                <p className="ml-6 text-xs text-slate-500">{equipment.customer.phone}</p>
              )}
              {equipment.branch && (
                <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{equipment.branch.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {equipment.notes && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="specifications" /></h3>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{equipment.notes}</p>
            </div>
          )}
        </div>

        {/* Right columns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Meter readings */}
          {showMeter && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-slate-400" />
                <T k="meterReadings" />
              </h3>
              {equipment.meterReadings.length === 0 ? (
                <p className="text-sm text-slate-400 italic"><T k="noMeterReadings" /></p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                        <th className="pb-2 text-left"><T k="date" /></th>
                        <th className="pb-2 text-right"><T k="black" /></th>
                        <th className="pb-2 text-right"><T k="colour" /></th>
                        <th className="pb-2 text-left pl-4"><T k="source" /></th>
                        <th className="pb-2 text-left pl-4"><T k="recordedBy" /></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {equipment.meterReadings.map((r) => (
                        <tr key={r.id} className="text-slate-700">
                          <td className="py-2 text-xs text-slate-500 whitespace-nowrap">
                            {format(new Date(r.readingDate), "dd MMM yyyy")}
                          </td>
                          <td className="py-2 text-right font-mono text-sm">
                            {r.blackPages?.toLocaleString() ?? "—"}
                          </td>
                          <td className="py-2 text-right font-mono text-sm">
                            {r.colorPages?.toLocaleString() ?? "—"}
                          </td>
                          <td className="py-2 pl-4">
                            {r.job ? (
                              <Link href={`/jobs/${r.job.id}`} className="text-xs text-blue-600 hover:underline">
                                {r.job.jobNumber}
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">{r.notes ?? <T k="manual" />}</span>
                            )}
                          </td>
                          <td className="py-2 pl-4 text-xs text-slate-500">{r.recordedBy.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Service history */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900"><T k="serviceHistory" /></h3>
              <Link href={`/jobs/new?customerId=${equipment.customerId}&equipmentId=${equipment.id}`}>
                <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />}><T k="newJob" /></Button>
              </Link>
            </div>
            {equipment.serviceJobs.length === 0 ? (
              <EmptyState
                title={<T k="noServiceHistory" />}
                description={<T k="serviceJobsWillAppear" />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr>
                      {[<T key="jobNumber" k="jobNumber" />, <T key="serviceType" k="serviceType" />, <T key="status" k="status" />, <T key="priority" k="priority" />, <T key="engineer" k="engineer" />, <T key="received" k="received" />, <T key="completed" k="completed" />, <T key="warranty" k="warranty" />].map((h, i) => (
                        <th key={i} className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {equipment.serviceJobs.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50">
                        <td className="py-2 pr-4">
                          <Link href={`/jobs/${j.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                            {j.jobNumber}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-600 whitespace-nowrap">{j.serviceType}</td>
                        <td className="py-2 pr-4"><StatusBadge status={j.status} /></td>
                        <td className="py-2 pr-4"><PriorityBadge priority={j.priority} /></td>
                        <td className="py-2 pr-4 text-xs text-slate-600 whitespace-nowrap">{j.assignedTo.name}</td>
                        <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">
                          {format(new Date(j.receivedDate), "dd MMM yyyy")}
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">
                          {j.completedAt ? format(new Date(j.completedAt), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="py-2 text-xs whitespace-nowrap">
                          {j.completedAt ? <WarrantyBadge warrantyExpires={j.warrantyExpires} /> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quotations */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <T k="quotations" />
              </h3>
              <Link href={`/quotations/new?customerId=${equipment.customerId}&equipmentId=${equipment.id}`}>
                <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />}><T k="newQuotation" /></Button>
              </Link>
            </div>
            {equipment.quotations.length === 0 ? (
              <p className="text-sm text-slate-400 italic"><T k="noQuotationsForEquipment" /></p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr>
                      {[<T key="quotationNumber" k="quotationNumber" />, <T key="serviceType" k="serviceType" />, <T key="total" k="total" />, <T key="status" k="status" />, <T key="date" k="date" />, ""].map((h, i) => (
                        <th key={i} className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {equipment.quotations.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50">
                        <td className="py-2 pr-4">
                          <span className="font-mono text-xs font-semibold text-slate-700">{q.quotationNumber}</span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-600 whitespace-nowrap">
                          {SERVICE_TYPE_LABELS[q.serviceType]}
                        </td>
                        <td className="py-2 pr-4 text-sm font-semibold text-slate-700">
                          {formatCurrency(Number(q.totalCost))}
                        </td>
                        <td className="py-2 pr-4">
                          <QuotationStatusBadge status={q.status} />
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">
                          {format(new Date(q.createdAt), "dd MMM yyyy")}
                        </td>
                        <td className="py-2">
                          <Link href={`/quotations/${q.id}`} className="text-xs text-blue-600 hover:underline">
                            <T k="view" /> →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
