import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Search, Download, Users as UsersIcon } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomers } from "@/lib/data/customers"
import { canAccess, canCreateCustomer, canEditCustomer } from "@/lib/permissions"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Table } from "@/components/ui/table"
import { T, NoResultsFor, TInput } from "@/components/ui/T"
import { CustomerActions } from "@/components/customers/CustomerActions"
import { AppCard } from "@/components/app-ui/AppCard"
import { AppEmptyState } from "@/components/app-ui/AppEmptyState"
import { AppSearchField } from "@/components/app-ui/AppSearchField"
import type { Role } from "@/types"

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = (session!.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) redirect("/dashboard")
  const { search = "" } = await searchParams
  const companyId = session!.user.companyId as string

  const customers = await getCustomers(companyId, search || undefined)
  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {customers.length} <T k="customers" /> <T k="registered" />
          </p>
        </div>

        <div className="flex gap-2">
          {canCreateCustomer(role, permissions) && (
            <Link href="/customers/new" className="flex-1">
              <Button icon={<Plus className="h-4 w-4" />} size="sm" className="w-full">
                <T k="newCustomer" />
              </Button>
            </Link>
          )}
          <a href="/api/customers/summary/pdf" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>
              <T k="exportPdf" />
            </Button>
          </a>
        </div>

        <form method="GET" className="flex gap-2">
          <div className="flex-1">
            <AppSearchField name="search" placeholderKey="searchCustomersPlaceholder" defaultValue={search} />
          </div>
          <button
            type="submit"
            aria-label="Search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-500 transition-colors active:bg-slate-50"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        {customers.length === 0 ? (
          <AppEmptyState
            icon={<UsersIcon className="h-8 w-8" />}
            title={<T k="noCustomersFound" />}
            description={
              search ? (
                <>
                  <NoResultsFor search={search} /> <T k="tryDifferentSearchTerm" />
                </>
              ) : (
                <T k="registerFirstCustomer" />
              )
            }
          />
        ) : (
          <div className="space-y-2">
            {customers.map((customer) => (
              <AppCard key={customer.id} href={`/customers/${customer.id}`}>
                <p className="truncate text-[15px] font-semibold text-slate-900">{customer.companyName}</p>
                <div className="mt-0.5 space-y-0.5">
                  {customer.pinNumber && (
                    <p className="truncate text-xs text-slate-500">
                      <T k="pinNumber" />: <span className="font-mono">{customer.pinNumber}</span>
                    </p>
                  )}
                  {customer.name && (
                    <p className="truncate text-xs text-slate-500">
                      <T k="mainContactName" />: {customer.name}
                    </p>
                  )}
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
        title={<T k="customers" />}
        subtitle={<>{customers.length} <T k="customers" /> <T k="registered" /></>}
        actions={
          <div className="flex gap-2">
            <a href="/api/customers/summary/pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" icon={<Download className="h-4 w-4" />}><T k="exportPdf" /></Button>
            </a>
            {canCreateCustomer(role, permissions) && (
              <Link href="/customers/new">
                <Button icon={<Plus className="h-4 w-4" />}><T k="newCustomer" /></Button>
              </Link>
            )}
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
              <Link href={`/customers/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
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
            label: <T k="mainContactName" />,
            render: (row) => <span className="text-slate-600">{row.name ?? "—"}</span>,
          },
          {
            key: "phone",
            label: <T k="mainContactPhone" />,
            render: (row) => <span className="text-slate-600 whitespace-nowrap">{row.phone ?? "—"}</span>,
          },
          {
            key: "projectCount",
            label: <T k="numberOfProjects" />,
            render: (row) => <span className="text-slate-600">{row.projectCount}</span>,
          },
          {
            key: "actions",
            label: "",
            render: (row) => <CustomerActions customerId={row.id} isActive={row.isActive} canEdit={canEditCustomer(role, permissions)} />,
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
