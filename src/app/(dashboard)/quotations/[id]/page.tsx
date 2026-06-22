import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ChevronLeft, User, MapPin, Wrench, Calendar, Clock,
  Package, Briefcase, FileText,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { getQuotation } from "@/lib/data/quotations"
import { canAccess } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { QuotationStatusBadge, EquipmentTypeBadge } from "@/components/ui/badge"
import { QuotationActions } from "@/components/quotations/QuotationActions"
import { formatCurrency } from "@/lib/utils"
import { SERVICE_TYPE_LABELS, QUOTATION_STATUS_LABELS } from "@/types"
import { format } from "date-fns"
import { T } from "@/components/ui/T"

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const role = session!.user.role as import("@/types").Role
  if (!canAccess(role, "quotations")) redirect("/dashboard")
  const { id } = await params
  const companyId = session!.user.companyId as string

  const quotation = await getQuotation(id, companyId)
  if (!quotation) notFound()

  const partsCost = Number(quotation.partsCost)
  const labourCost = Number(quotation.labourCost)
  const diagnosisFee = Number(quotation.diagnosisFee)
  const transportFee = Number(quotation.transportFee)
  const vatPercent = Number(quotation.vatPercent)
  const discountAmount = Number(quotation.discountAmount)
  const totalCost = Number(quotation.totalCost)
  const subtotal = labourCost + partsCost + diagnosisFee + transportFee
  const vatAmount = (subtotal * vatPercent) / 100

  return (
    <div>
      <Link
        href="/quotations"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        <T k="quotations" />
      </Link>

      <PageHeader
        title={quotation.quotationNumber}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <QuotationStatusBadge status={quotation.status} />
            <span className="text-slate-400 text-xs">
              {SERVICE_TYPE_LABELS[quotation.serviceType]}
            </span>
            {quotation.validUntil && (
              <span className="text-slate-400 text-xs">
                <T k="validUntil" /> {format(new Date(quotation.validUntil), "dd MMM yyyy")}
              </span>
            )}
          </span>
        }
        actions={
          <QuotationActions
            quotationId={quotation.id}
            status={quotation.status}
            role={role}
          />
        }
      />

      {/* Converted-to-job banner */}
      {quotation.convertedJob && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <Briefcase className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800">
            <T k="convertedToJob" />{" "}
            <Link
              href={`/jobs/${quotation.convertedJob.id}`}
              className="font-semibold text-green-700 hover:underline"
            >
              {quotation.convertedJob.jobNumber}
            </Link>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Customer info */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="customer" /></h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <Link
                    href={`/customers/${quotation.customer.id}`}
                    className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                  >
                    {quotation.customer.name}
                  </Link>
                  {quotation.customer.companyName && (
                    <p className="text-xs text-slate-500">{quotation.customer.companyName}</p>
                  )}
                </div>
              </div>
              {quotation.branch && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-600">{quotation.branch.name}</p>
                    {quotation.branch.address && (
                      <p className="text-xs text-slate-400">{quotation.branch.address}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Equipment info */}
          {quotation.equipment && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="equipment" /></h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <EquipmentTypeBadge type={quotation.equipment.type} />
                </div>
                <Link
                  href={`/equipment/${quotation.equipment.id}`}
                  className="block font-medium text-slate-900 hover:text-blue-600 transition-colors"
                >
                  {quotation.equipment.brand} {quotation.equipment.model}
                </Link>
                <p className="font-mono text-xs text-slate-400">{quotation.equipment.serialNumber}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="details" /></h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="createdBy" /></dt>
                <dd className="text-slate-700">{quotation.createdBy.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="createdLabel" /></dt>
                <dd className="text-slate-700">{format(new Date(quotation.createdAt), "dd MMM yyyy")}</dd>
              </div>
              {quotation.approvedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500"><T k="approved" /></dt>
                  <dd className="text-slate-700">{format(new Date(quotation.approvedAt), "dd MMM yyyy")}</dd>
                </div>
              )}
              {quotation.validUntil && (
                <div className="flex justify-between">
                  <dt className="text-slate-500"><T k="validUntil" /></dt>
                  <dd className="text-slate-700">{format(new Date(quotation.validUntil), "dd MMM yyyy")}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Problem description */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-slate-400" />
              <T k="problemDescription" />
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {quotation.problemDesc}
            </p>
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-400" />
              <T k="spareParts" />
            </h3>
            {quotation.items.length === 0 ? (
              <p className="text-sm text-slate-400 italic"><T k="noSparePartsListed" /></p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                      <th className="pb-2 text-left"><T k="description" /></th>
                      <th className="pb-2 text-right"><T k="quantity" /></th>
                      <th className="pb-2 text-right"><T k="unitPrice" /></th>
                      <th className="pb-2 text-right"><T k="subtotal" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {quotation.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 text-slate-700">{item.description}</td>
                        <td className="py-2 text-right text-slate-600">{item.quantity}</td>
                        <td className="py-2 text-right text-slate-600">{formatCurrency(Number(item.unitPrice))}</td>
                        <td className="py-2 text-right font-medium text-slate-700">{formatCurrency(Number(item.subtotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cost summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="costSummary" /></h3>
            <div className="max-w-sm ml-auto space-y-2 text-sm">
              {labourCost > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span><T k="labour" /></span>
                  <span>{formatCurrency(labourCost)}</span>
                </div>
              )}
              {partsCost > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span><T k="parts" /> ({quotation.items.length})</span>
                  <span>{formatCurrency(partsCost)}</span>
                </div>
              )}
              {diagnosisFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span><T k="diagnosisFee" /></span>
                  <span>{formatCurrency(diagnosisFee)}</span>
                </div>
              )}
              {transportFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span><T k="transportFee" /></span>
                  <span>{formatCurrency(transportFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700 border-t border-slate-100 pt-2">
                <span><T k="subtotal" /></span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {vatPercent > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span><T k="vat" /> ({vatPercent}%)</span>
                  <span>{formatCurrency(vatAmount)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span><T k="discount" /></span>
                  <span>({formatCurrency(discountAmount)})</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2">
                <span><T k="total" /></span>
                <span>{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          {quotation.remarks && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <T k="remarks" />
              </h3>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{quotation.remarks}</p>
            </div>
          )}

          {/* Internal notes */}
          {quotation.internalNotes && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
              <h3 className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">
                <T k="internalNotes" />
              </h3>
              <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{quotation.internalNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
