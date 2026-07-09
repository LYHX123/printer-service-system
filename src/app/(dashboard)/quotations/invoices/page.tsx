import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import { getInvoices } from "@/lib/data/invoices"
import { canAccess } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Table } from "@/components/ui/table"
import { T, TInput } from "@/components/ui/T"
import { Button } from "@/components/ui/button"
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
  if (!canAccess(role, "quotations")) redirect("/dashboard")
  const { search } = await searchParams
  const companyId = session!.user.companyId as string

  const invoices = await getInvoices(companyId, { search: search || undefined })

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
      />

      <form method="get" className="filter-bar mb-4 flex flex-wrap gap-2">
        <TInput
          name="search"
          type="search"
          defaultValue={search}
          placeholderKey="searchInvoicesPlaceholder"
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
            key: "quotation",
            label: <T k="quotations" />,
            render: (row) => (
              <Link href={`/quotations/${row.quotation.id}`} className="text-xs text-blue-600 hover:underline">
                {row.quotation.quotationNumber}
              </Link>
            ),
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
            key: "actions",
            label: "",
            headerClassName: "text-right",
            className: "text-right",
            render: (row) => (
              <Link href={`/quotations/invoices/${row.id}`} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                <T k="view" /> →
              </Link>
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
