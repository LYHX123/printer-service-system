import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomers } from "@/lib/data/customers"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table } from "@/components/ui/table"
import { format } from "date-fns"

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
        title="Customers"
        subtitle={`${customers.length} customer${customers.length !== 1 ? "s" : ""} registered`}
        actions={
          <Link href="/customers/new">
            <Button icon={<Plus className="h-4 w-4" />}>New Customer</Button>
          </Link>
        }
      />

      {/* Search */}
      <form method="GET" className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            name="search"
            type="search"
            placeholder="Search by name, code or company…"
            defaultValue={search}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" size="md">Search</Button>
        {search && (
          <Link href="/customers">
            <Button variant="ghost" size="md">Clear</Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          { key: "code", label: "Code", className: "font-mono text-xs text-slate-500 whitespace-nowrap" },
          {
            key: "name",
            label: "Customer",
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
          { key: "phone", label: "Phone", className: "text-slate-600 whitespace-nowrap" },
          {
            key: "email",
            label: "Email",
            render: (row) => <span className="text-slate-500">{row.email ?? "—"}</span>,
          },
          {
            key: "equipment",
            label: "Equipment",
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
            label: "Jobs",
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
            label: "Registered",
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
                View →
              </Link>
            ),
          },
        ]}
        data={customers}
        keyExtractor={(row) => row.id}
        emptyTitle="No customers found"
        emptyDescription={
          search
            ? `No results for "${search}". Try a different search term.`
            : "Register your first customer to get started."
        }
      />
    </div>
  )
}
