import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { FileText, Plus, Receipt, Calendar } from "lucide-react"
import { auth } from "@/lib/auth"
import { getQuotations } from "@/lib/data/quotations"
import { canAccess, canCreateQuotation, canDeleteQuotationPerm } from "@/lib/permissions"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { QuotationStatusBadge } from "@/components/ui/badge"
import { QUOTATION_STATUS_LABELS } from "@/types"
import type { QuotationStatus, Role } from "@/types"
import { T, TInput } from "@/components/ui/T"
import { QuotationsTable } from "@/components/quotations/QuotationsTable"
import { AppCard } from "@/components/app-ui/AppCard"
import { AppEmptyState } from "@/components/app-ui/AppEmptyState"
import { AppSearchField } from "@/components/app-ui/AppSearchField"
import { AppListMeta } from "@/components/app-ui/AppListMeta"
import { formatCurrency } from "@/lib/utils"

const STATUS_OPTIONS = Object.entries(QUOTATION_STATUS_LABELS) as [QuotationStatus, string][]

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  if (!canAccess(role, "quotations", session!.user.modulePermissions)) redirect("/dashboard")
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
  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {quotations.length} <T k="quotations" />
        </p>

        <div className="flex gap-2">
          {canCreateQuotation(role, session!.user.modulePermissions) && (
            <Link href="/quotations/new" className="flex-1">
              <Button icon={<Plus className="h-4 w-4" />} size="sm" className="w-full">
                <T k="newQuotation" />
              </Button>
            </Link>
          )}
          <Link href="/quotations/invoices">
            <Button variant="outline" size="sm" icon={<Receipt className="h-4 w-4" />}>
              <T k="invoices" />
            </Button>
          </Link>
        </div>

        <form method="get" className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <AppSearchField name="search" defaultValue={search} />
            </div>
            <button
              type="submit"
              aria-label="Search"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-500 transition-colors active:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
            </button>
          </div>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value=""><T k="allStatuses" /></option>
            {STATUS_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </form>

        {quotations.length === 0 ? (
          <AppEmptyState
            icon={<FileText className="h-8 w-8" />}
            title={<T k="noQuotationsFound" />}
            description={search || status ? <T k="tryAdjustingSearchOrFilter" /> : <T k="createFirstQuotation" />}
          />
        ) : (
          <div className="space-y-2">
            {quotations.map((q) => (
              <AppCard key={q.id} href={`/quotations/${q.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {q.quotationNumber}
                  </span>
                  <QuotationStatusBadge status={q.status} />
                </div>
                <p className="mt-1 truncate text-[14px] font-semibold text-slate-900">{q.customer.companyName}</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <AppListMeta icon={<Calendar />}>{format(new Date(q.createdAt), "dd MMM yyyy")}</AppListMeta>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(Number(q.totalCost))}</span>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </div>
    )
  }

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
            {canCreateQuotation(role, session!.user.modulePermissions) && (
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
        <QuotationsTable
          quotations={quotations}
          canDelete={canDeleteQuotationPerm(role, session!.user.modulePermissions)}
        />
      )}
    </div>
  )
}
