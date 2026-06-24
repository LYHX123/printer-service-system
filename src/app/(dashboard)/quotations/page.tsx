import Link from "next/link"
import { redirect } from "next/navigation"
import { FileText, Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { getQuotations } from "@/lib/data/quotations"
import { canAccess, canCreateQuotation } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { QuotationStatusBadge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency } from "@/lib/utils"
import { QUOTATION_STATUS_LABELS } from "@/types"
import type { QuotationStatus, Role } from "@/types"
import { format } from "date-fns"
import { T, TInput } from "@/components/ui/T"

const STATUS_OPTIONS = Object.entries(QUOTATION_STATUS_LABELS) as [QuotationStatus, string][]

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  if (!canAccess(role, "quotations")) redirect("/dashboard")
  const { search, status } = await searchParams
  const companyId = session!.user.companyId as string

  const validStatuses = Object.keys(QUOTATION_STATUS_LABELS) as QuotationStatus[]
  const statusFilter = validStatuses.includes(status as QuotationStatus)
    ? (status as QuotationStatus)
    : undefined

  const quotations = await getQuotations(companyId, {
    search: search || undefined,
    status: statusFilter,
  })

  return (
    <div>
      <PageHeader
        title={<T k="quotations" />}
        subtitle={<T k="createAndManageQuotations" />}
        actions={
          canCreateQuotation(role) ? (
            <Link href="/quotations/new">
              <Button icon={<Plus className="h-4 w-4" />}><T k="newQuotation" /></Button>
            </Link>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <form method="get" className="flex gap-2 flex-wrap">
          <TInput
            name="search"
            type="search"
            defaultValue={search}
            placeholderKey="searchQuotationsPlaceholder"
            className="h-9 w-56"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value=""><T k="allStatuses" /></option>
            {STATUS_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="sm"><T k="filter" /></Button>
          {(search || status) && (
            <Link href="/quotations">
              <Button variant="ghost" size="sm"><T k="clear" /></Button>
            </Link>
          )}
        </form>
      </div>

      {quotations.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title={<T k="noQuotationsFound" />}
            description={
              search || status
                ? <T k="tryAdjustingSearchOrFilter" />
                : <T k="createFirstQuotation" />
            }
          />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[<T key="quotationNumber" k="quotationNumber" />, <T key="customer" k="customer" />, <T key="total" k="total" />, <T key="status" k="status" />, <T key="date" k="date" />, ""].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {q.quotationNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{q.customer.companyName}</div>
                      {q.customer.name && (
                        <div className="text-xs text-slate-500">{q.customer.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(Number(q.totalCost))}
                    </td>
                    <td className="px-4 py-3">
                      <QuotationStatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(q.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                      >
                        <T k="view" /> →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
