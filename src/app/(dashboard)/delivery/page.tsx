import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Truck } from "lucide-react"
import { auth } from "@/lib/auth"
import { getDeliveries } from "@/lib/data/deliveries"
import { canAccess, canCreateDelivery, canEditDelivery, canDeleteDelivery } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Table } from "@/components/ui/table"
import { DeliveryInvoiceStatusBadge } from "@/components/ui/badge"
import { DeliveryListActions } from "@/components/delivery/DeliveryListActions"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import type { Role } from "@/types"

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  if (!canAccess(role, "delivery", permissions)) redirect("/dashboard")
  const { search } = await searchParams
  const companyId = session!.user.companyId as string

  const deliveries = await getDeliveries(companyId, { search: search || undefined })

  return (
    <div>
      <PageHeader
        title="Delivery"
        subtitle="Delivery notes and inventory movement"
        actions={
          canCreateDelivery(role, permissions) && (
            <Link href="/delivery/new">
              <Button icon={<Plus className="h-4 w-4" />}>Create Delivery</Button>
            </Link>
          )
        }
      />

      <form method="get" className="filter-bar mb-4 flex flex-wrap gap-2">
        <input
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Search deliveries…"
          className="h-9 w-64 rounded-lg border border-slate-300 px-3 text-sm"
        />
        <Button type="submit" variant="secondary" size="sm">Filter</Button>
        {search && (
          <Link href="/delivery">
            <Button variant="ghost" size="sm">Clear</Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "deliveryNumber",
            label: "Delivery No.",
            render: (row) => (
              <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {row.deliveryNumber}
              </span>
            ),
          },
          {
            key: "customer",
            label: "Customer",
            render: (row) => (
              <div>
                <span className="text-sm font-medium text-slate-900">{row.customer.companyName}</span>
                {row.customerBranch && <p className="text-xs text-slate-400">{row.customerBranch.name}</p>}
              </div>
            ),
          },
          {
            key: "quotation",
            label: "Source",
            render: (row) =>
              row.quotation ? (
                <Link href={`/quotations/${row.quotation.id}`} className="text-xs font-mono text-blue-600 hover:underline">
                  {row.quotation.quotationNumber}
                </Link>
              ) : (
                <span className="text-xs text-slate-400 italic">Manual</span>
              ),
          },
          {
            key: "deliveryDate",
            label: "Date",
            render: (row) => (
              <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.deliveryDate), "dd MMM yyyy")}</span>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <DeliveryInvoiceStatusBadge invoiced={Boolean(row.invoice)} />,
          },
          {
            key: "actions",
            label: "",
            headerClassName: "text-right",
            className: "text-right",
            render: (row) => (
              <DeliveryListActions
                deliveryId={row.id}
                hasInvoice={Boolean(row.invoice)}
                canEdit={canEditDelivery(role, permissions)}
                canDelete={canDeleteDelivery(role, permissions)}
              />
            ),
          },
        ]}
        data={deliveries}
        keyExtractor={(row) => row.id}
        emptyTitle="No deliveries found"
        emptyDescription={
          <span className="inline-flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Create a delivery manually or convert one from a Quotation.
          </span>
        }
      />
    </div>
  )
}
