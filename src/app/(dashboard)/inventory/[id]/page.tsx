import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { format } from "date-fns"
import { ChevronLeft, Hash, Tag, Truck, MapPin, Package } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess, canManageInventory } from "@/lib/permissions"
import { getSparePart, getStockLevel } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { PartCategoryBadge, StockLevelBadge, TransactionTypeBadge } from "@/components/ui/badge"
import { SparePartActions } from "@/components/inventory/SparePartActions"
import { formatCurrency } from "@/lib/utils"
import { PART_CATEGORY_LABELS } from "@/types"
import type { Role } from "@/types"

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
  const stockLevel = getStockLevel(quantity, part.reorderLevel)
  const stockValue = quantity * Number(part.unitCost)

  return (
    <div>
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Inventory
      </Link>

      <PageHeader
        title={part.name}
        subtitle={
          <span className="flex items-center gap-2">
            <PartCategoryBadge category={part.category} />
            <span className="font-mono text-xs text-slate-400">{part.partNumber}</span>
            {!part.isActive && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Archived</span>
            )}
          </span>
        }
        actions={
          <SparePartActions
            partId={part.id}
            currentQuantity={quantity}
            unit={part.unit}
            isActive={part.isActive}
            canEdit={canEdit}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Details column */}
        <div className="space-y-4">
          {/* Specs */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Part Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Hash className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-400">Part Number</dt>
                  <dd className="font-mono font-semibold">{part.partNumber}</dd>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Tag className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <dt className="text-xs text-slate-400">Category</dt>
                  <dd>{PART_CATEGORY_LABELS[part.category]}</dd>
                </div>
              </div>
              {part.brand && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Package className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-400">Brand</dt>
                    <dd>{part.brand}</dd>
                  </div>
                </div>
              )}
              {part.supplier && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-400">Supplier</dt>
                    <dd>{part.supplier}</dd>
                  </div>
                </div>
              )}
              {part.stock?.location && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-400">Storage Location</dt>
                    <dd>{part.stock.location}</dd>
                  </div>
                </div>
              )}
              {part.compatibleWith && (
                <div>
                  <dt className="text-xs text-slate-400 mb-1">Compatible With</dt>
                  <dd className="text-slate-600">{part.compatibleWith}</dd>
                </div>
              )}
              {part.description && (
                <div>
                  <dt className="text-xs text-slate-400 mb-1">Description</dt>
                  <dd className="text-slate-600 whitespace-pre-line leading-relaxed">{part.description}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Stock summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Stock</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Current Quantity</dt>
                <dd className="font-mono text-base font-semibold text-slate-900">{quantity} {part.unit}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Minimum Quantity</dt>
                <dd className="font-mono text-slate-700">{part.reorderLevel} {part.unit}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd><StockLevelBadge level={stockLevel} /></dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <dt className="text-slate-500">Unit Cost</dt>
                <dd className="font-medium text-slate-700">{formatCurrency(Number(part.unitCost))}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Selling Price</dt>
                <dd className="font-medium text-slate-700">{formatCurrency(Number(part.sellingPrice))}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <dt className="text-slate-500">Stock Value (at cost)</dt>
                <dd className="font-semibold text-slate-900">{formatCurrency(stockValue)}</dd>
              </div>
              {part.stock?.lastCounted && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Last Counted</dt>
                  <dd className="text-xs text-slate-500">{format(new Date(part.stock.lastCounted), "dd MMM yyyy")}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Right columns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Transaction history */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Transaction History</h3>
            {part.transactions.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No stock transactions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr>
                      {["Date", "Type", "Quantity", "Unit Price", "Reference", "Job", "By"].map((h) => (
                        <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {part.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">
                          {format(new Date(t.createdAt), "dd MMM yyyy HH:mm")}
                        </td>
                        <td className="py-2 pr-4"><TransactionTypeBadge type={t.type} /></td>
                        <td className="py-2 pr-4 font-mono text-sm">
                          <span className={t.quantity < 0 ? "text-red-600" : t.quantity > 0 ? "text-green-700" : "text-slate-500"}>
                            {t.quantity > 0 ? "+" : ""}{t.quantity} {part.unit}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-sm text-slate-600">
                          {t.unitPrice != null ? formatCurrency(Number(t.unitPrice)) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-500">{t.reference ?? "—"}</td>
                        <td className="py-2 pr-4 text-xs">
                          {t.job ? (
                            <Link href={`/jobs/${t.job.id}`} className="font-mono text-blue-600 hover:underline">
                              {t.job.jobNumber}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="py-2 text-xs text-slate-500 whitespace-nowrap">{t.performedBy.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Usage in jobs */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Used In Jobs</h3>
            {part.jobParts.length === 0 ? (
              <p className="text-sm text-slate-400 italic">This part hasn&apos;t been used in any jobs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr>
                      {["Job #", "Quantity", "Unit Price", "Total"].map((h) => (
                        <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pr-4">{h}</th>
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
