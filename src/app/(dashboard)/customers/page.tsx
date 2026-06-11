import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomers } from "@/lib/data/customers"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Table } from "@/components/ui/table"
import { format } from "date-fns"
import { T, NoResultsFor, TInput } from "@/components/ui/T"

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
          <Link href="/customers/new">
            <Button icon={<Plus className="h-4 w-4" />}><T k="newCustomer" /></Button>
          </Link>
        }
      />

      {/* Search */}
      <form method="GET" className="flex gap-2 mb-4">
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
          { key: "code", label: <T k="code" />, className: "font-mono text-xs text-slate-500 whitespace-nowrap" },
          {
            key: "name",
            label: <T k="customer" />,
            render: (row) => (
              <div>
                <Link href={`/customers/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                  {row.name}
                </Link>
                {row.companyName && (
                  <p className="text-xs text-slate-400 mt-0.5">{row.companyName}</p>
                )}
              </div>
            ),
          },
          { key: "phone", label: <T k="phone" />, className: "text-slate-600 whitespace-nowrap" },
          {
            key: "email",
            label: <T k="email" />,
            render: (row) => <span className="text-slate-500">{row.email ?? "—"}</span>,
          },
          {
            key: "equipment",
            label: <T k="equipment" />,
            className: "text-center",
            headerClassName: "text-center",
            render: (row) => (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {row._count.equipment}
              </span>
            ),
          },
          {
            key: "jobs",
            label: <T k="jobs" />,
            className: "text-center",
            headerClassName: "text-center",
            render: (row) => (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {row._count.serviceJobs}
              </span>
            ),
          },
          {
            key: "createdAt",
            label: <T k="registered" />,
            render: (row) => (
              <span className="text-slate-500 text-xs whitespace-nowrap">
                {format(new Date(row.createdAt), "dd MMM yyyy")}
              </span>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (row) => (
              <Link href={`/customers/${row.id}`} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                <T k="view" /> →
              </Link>
            ),
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
