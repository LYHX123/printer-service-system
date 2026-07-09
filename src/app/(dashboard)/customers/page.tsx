import Link from "next/link"
import { Plus, Search, Download } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomers } from "@/lib/data/customers"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Table } from "@/components/ui/table"
import { T, NoResultsFor, TInput } from "@/components/ui/T"
import { CustomerActions } from "@/components/customers/CustomerActions"

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const session = await auth()
  const { search = "" } = await searchParams
  const companyId = session!.user.companyId as string

  const customers = await getCustomers(companyId, search || undefined)

  return (
    <div>
      <PageHeader
        title={<T k="customers" />}
        subtitle={<>{customers.length} <T k="customers" /> <T k="registered" /></>}
        actions={
          <div className="flex gap-2">
            <a href="/api/customers/summary/pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" icon={<Download className="h-4 w-4" />}><T k="exportPdf" /></Button>
            </a>
            <Link href="/customers/new">
              <Button icon={<Plus className="h-4 w-4" />}><T k="newCustomer" /></Button>
            </Link>
          </div>
        }
      />

      {/* Search */}
      <form method="GET" className="filter-bar flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <TInput
            name="search"
            type="search"
            placeholderKey="searchCustomersPlaceholder"
            defaultValue={search}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" size="md"><T k="search" /></Button>
        {search && (
          <Link href="/customers">
            <Button variant="ghost" size="md"><T k="clear" /></Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "companyName",
            label: <T k="companyName" />,
            render: (row) => (
              <Link href={`/customers/${row.id}/edit`} className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.companyName}
              </Link>
            ),
          },
          {
            key: "pinNumber",
            label: <T k="pinNumber" />,
            render: (row) => <span className="text-slate-500 font-mono text-xs">{row.pinNumber ?? "—"}</span>,
          },
          {
            key: "name",
            label: <T k="customerName" />,
            render: (row) => <span className="text-slate-600">{row.name ?? "—"}</span>,
          },
          { key: "phone", label: <T k="phone" />, className: "text-slate-600 whitespace-nowrap" },
          {
            key: "location",
            label: <T k="location" />,
            render: (row) => <span className="text-slate-500">{row.location ?? "—"}</span>,
          },
          {
            key: "actions",
            label: "",
            render: (row) => <CustomerActions customerId={row.id} isActive={row.isActive} />,
          },
        ]}
        data={customers}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noCustomersFound" />}
        emptyDescription={
          search
            ? <><NoResultsFor search={search} /> <T k="tryDifferentSearchTerm" /></>
            : <T k="registerFirstCustomer" />
        }
      />
    </div>
  )
}
