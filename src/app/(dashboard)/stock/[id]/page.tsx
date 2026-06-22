import Link from "next/link"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Hash, Package, ImageOff } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess, canManageInventory } from "@/lib/permissions"
import { getSparePart } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { SparePartActions } from "@/components/inventory/SparePartActions"
import { formatCurrency } from "@/lib/utils"
import { getStockType, STOCK_TYPE_LABELS } from "@/lib/stock-types"
import type { Role } from "@/types"
import { T } from "@/components/ui/T"

export default async function SparePartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "inventory")) redirect("/dashboard")
  const canEdit = canManageInventory(session!.user.role as Role)
  const companyId = session!.user.companyId as string

  const { id } = await params
  const part = await getSparePart(id, companyId)
  if (!part) notFound()

  const quantity = part.stock?.quantity ?? 0
  const stockType = getStockType(part.category)

  return (
    <div>
      <Link href="/stock" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="inventory" />
      </Link>

      <PageHeader
        title={part.name}
        subtitle={
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {STOCK_TYPE_LABELS[stockType]}
            </span>
            <span className="font-mono text-xs text-slate-400">{part.partNumber}</span>
            {!part.isActive && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500"><T k="archived" /></span>
            )}
          </span>
        }
        actions={
          <SparePartActions
            partId={part.id}
            isActive={part.isActive}
            canEdit={canEdit}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Details column */}
        <div className="space-y-4">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {part.imageUrl ? (
              <Image src={part.imageUrl} alt={part.name} width={400} height={400} className="h-full w-full object-cover" unoptimized />
            ) : (
              <ImageOff className="h-10 w-10 text-slate-300" />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="partDetails" /></h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Hash className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-400"><T k="partNumber" /></dt>
                  <dd className="font-mono font-semibold">{part.partNumber}</dd>
                </div>
              </div>
              {part.brand && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Package className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-400"><T k="brand" /></dt>
                    <dd>{part.brand}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="stock" /></h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500"><T k="currentQuantity" /></dt>
                <dd className="font-mono text-base font-semibold text-slate-900">{quantity}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Usage in jobs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="usedInJobs" /></h3>
            {part.jobParts.length === 0 ? (
              <p className="text-sm text-slate-400 italic"><T k="noPartsUsedInJobs" /></p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr>
                      {[<T key="jobNumber" k="jobNumber" />, <T key="quantity" k="quantity" />, <T key="unitPrice" k="unitPrice" />, <T key="total" k="total" />].map((h, i) => (
                        <th key={i} className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {part.jobParts.map((jp) => (
                      <tr key={jp.id} className="hover:bg-slate-50">
                        <td className="py-2 pr-4">
                          <Link href={`/jobs/${jp.report.job.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                            {jp.report.job.jobNumber}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 font-mono text-sm">{jp.quantity} {part.unit}</td>
                        <td className="py-2 pr-4 text-sm text-slate-600">{formatCurrency(Number(jp.unitPrice))}</td>
                        <td className="py-2 text-sm font-medium text-slate-700">{formatCurrency(Number(jp.unitPrice) * jp.quantity)}</td>
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
