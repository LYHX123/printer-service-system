import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, Plus, Receipt, Calendar } from "lucide-react"
import { auth } from "@/lib/auth"
import { getInvoices } from "@/lib/data/invoices"
import { canAccess, canCreateInvoice, canEditInvoice, canDeleteInvoice } from "@/lib/permissions"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { Table } from "@/components/ui/table"
import { InvoiceStatusBadge } from "@/components/ui/badge"
import { InvoiceListActions } from "@/components/quotations/InvoiceListActions"
import { T, TInput } from "@/components/ui/T"
import { Button } from "@/components/ui/button"
import { AppCard } from "@/components/app-ui/AppCard"
import { AppEmptyState } from "@/components/app-ui/AppEmptyState"
import { AppSearchField } from "@/components/app-ui/AppSearchField"
import { AppListMeta } from "@/components/app-ui/AppListMeta"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import type { Role } from "@/types"

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  if (!canAccess(role, "invoice", permissions)) redirect("/dashboard")
  const { search } = await searchParams
  const companyId = session!.user.companyId as string

  const invoices = await getInvoices(companyId, { search: search || undefined })
  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href="/quotations" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k="quotations" />
        </Link>

        <p className="text-sm text-slate-500">
          {invoices.length} <T k="invoices" />
        </p>

        {canCreateInvoice(role, permissions) && (
          <Link href="/quotations/invoices/new">
            <Button icon={<Plus className="h-4 w-4" />} size="sm" className="w-full">
              <T k="createInvoice" />
            </Button>
          </Link>
        )}

        <form method="get" className="flex gap-2">
          <div className="flex-1">
            <AppSearchField name="search" defaultValue={search} />
          </div>
          <button
            type="submit"
            aria-label="Search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-500 transition-colors active:bg-slate-50"
          >
            <Receipt className="h-4 w-4" />
          </button>
        </form>

        {invoices.length === 0 ? (
          <AppEmptyState icon={<Receipt className="h-8 w-8" />} title={<T k="noInvoicesFound" />} description={<T k="noInvoicesDesc" />} />
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <AppCard key={inv.id} href={`/quotations/invoices/${inv.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {inv.invoiceNumber}
                  </span>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
                <p className="mt-1 truncate text-[14px] font-semibold text-slate-900">{inv.customer.companyName}</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <AppListMeta icon={<Calendar />}>{format(new Date(inv.date), "dd MMM yyyy")}</AppListMeta>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(inv.totalAmount)}</span>
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
      <Link
        href="/quotations"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        <T k="quotations" />
      </Link>

      <PageHeader
        title={<T k="invoices" />}
        subtitle={<T k="invoicesDesc" />}
        actions={
          canCreateInvoice(role, permissions) && (
            <Link href="/quotations/invoices/new">
              <Button icon={<Plus className="h-4 w-4" />}><T k="createInvoice" /></Button>
            </Link>
          )
        }
      />

      <form method="get" className="filter-bar mb-4 flex flex-wrap gap-2">
        <TInput
          name="search"
          type="search"
          defaultValue={search}
          className="h-9 w-64"
        />
        <Button type="submit" variant="secondary" size="sm"><T k="filter" /></Button>
        {search && (
          <Link href="/quotations/invoices">
            <Button variant="ghost" size="sm"><T k="clear" /></Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "invoiceNumber",
            label: <T k="invoiceNumberLabel" />,
            render: (row) => (
              <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {row.invoiceNumber}
              </span>
            ),
          },
          {
            key: "customer",
            label: <T k="customer" />,
            render: (row) => <span className="text-sm font-medium text-slate-900">{row.customer.companyName}</span>,
          },
          {
            key: "totalAmount",
            label: <T k="total" />,
            render: (row) => <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.totalAmount)}</span>,
          },
          {
            key: "date",
            label: <T k="date" />,
            render: (row) => (
              <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.date), "dd MMM yyyy")}</span>
            ),
          },
          {
            key: "status",
            label: <T k="status" />,
            render: (row) => <InvoiceStatusBadge status={row.status} />,
          },
          {
            key: "actions",
            label: "",
            headerClassName: "text-right",
            className: "text-right",
            render: (row) => (
              <InvoiceListActions
                invoiceId={row.id}
                status={row.status}
                hasSalesLedgerEntry={Boolean(row.salesLedgerEntry)}
                canEdit={canEditInvoice(role, permissions)}
                canDelete={canDeleteInvoice(role, permissions)}
              />
            ),
          },
        ]}
        data={invoices}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noInvoicesFound" />}
        emptyDescription={
          <span className="inline-flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            <T k="noInvoicesDesc" />
          </span>
        }
      />
    </div>
  )
}
