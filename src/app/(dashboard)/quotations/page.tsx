import Link from "next/link"
import { redirect } from "next/navigation"
import { FileText, Plus, Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import { getQuotations } from "@/lib/data/quotations"
import { canAccess, canCreateQuotation } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { QUOTATION_STATUS_LABELS } from "@/types"
import type { QuotationStatus, Role } from "@/types"
import { T, TInput } from "@/components/ui/T"
import { QuotationsTable } from "@/components/quotations/QuotationsTable"

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
          <div className="flex items-center gap-2">
            <Link href="/quotations/invoices">
              <Button variant="outline" icon={<Receipt className="h-4 w-4" />}><T k="invoices" /></Button>
            </Link>
            {canCreateQuotation(role) && (
              <Link href="/quotations/new">
                <Button icon={<Plus className="h-4 w-4" />}><T k="newQuotation" /></Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <form method="get" className="filter-bar flex gap-2 flex-wrap">
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
        <QuotationsTable quotations={quotations} />
      )}
    </div>
  )
}
