import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { auth } from "@/lib/auth"
import { getEquipmentList } from "@/lib/data/equipment"
import { getCustomerOptions } from "@/lib/data/customers"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table } from "@/components/ui/table"
import { EquipmentTypeBadge } from "@/components/ui/badge"
import { EQUIPMENT_TYPE_LABELS } from "@/types"
import type { EquipmentType } from "@/types"
import { format } from "date-fns"

const EQUIPMENT_TYPES = Object.keys(EQUIPMENT_TYPE_LABELS) as EquipmentType[]

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string; customerId?: string }>
}) {
  const session = await auth()
  const { search = "", type, customerId } = await searchParams
  const companyId = session!.user.companyId as string

  const validType = type && EQUIPMENT_TYPES.includes(type as EquipmentType)
    ? (type as EquipmentType)
    : undefined

  const [equipment, customers] = await Promise.all([
    getEquipmentList(companyId, {
      search: search || undefined,
      type: validType,
      customerId: customerId || undefined,
    }),
    getCustomerOptions(companyId),
  ])

  return (
    <div>
      <PageHeader
        title="Equipment"
        subtitle={`${equipment.length} unit${equipment.length !== 1 ? "s" : ""} registered`}
        actions={
          <Link href="/equipment/new">
            <Button icon={<Plus className="h-4 w-4" />}>Register Equipment</Button>
          </Link>
        }
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            name="search"
            type="search"
            placeholder="Serial, brand, model…"
            defaultValue={search}
            className="pl-9"
          />
        </div>
        <Select name="type" defaultValue={type ?? ""} className="w-44">
          <option value="">All Types</option>
          {EQUIPMENT_TYPES.map((t) => (
            <option key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <Select name="customerId" defaultValue={customerId ?? ""} className="w-52">
          <option value="">All Customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
        {(search || type || customerId) && (
          <Link href="/equipment">
            <Button variant="ghost">Clear</Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "type",
            label: "Type",
            render: (row) => <EquipmentTypeBadge type={row.type} />,
          },
          {
            key: "brand",
            label: "Brand / Model",
            render: (row) => (
              <div>
                <Link href={`/equipment/${row.id}`} className="font-medium text-sm text-slate-900 hover:text-blue-600 transition-colors">
                  {row.brand} {row.model}
                </Link>
                <p className="font-mono text-xs text-slate-400 mt-0.5">{row.serialNumber}</p>
              </div>
            ),
          },
          {
            key: "customer",
            label: "Customer",
            render: (row) => (
              <div>
                <Link href={`/customers/${row.customer.id}`} className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
                  {row.customer.name}
                </Link>
                {row.customer.companyName && (
                  <p className="text-xs text-slate-400 mt-0.5">{row.customer.companyName}</p>
                )}
              </div>
            ),
          },
          {
            key: "branch",
            label: "Branch",
            render: (row) => (
              <span className="text-sm text-slate-500">{row.branch?.name ?? "—"}</span>
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
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {format(new Date(row.createdAt), "dd MMM yyyy")}
              </span>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (row) => (
              <Link href={`/equipment/${row.id}`} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                View →
              </Link>
            ),
          },
        ]}
        data={equipment}
        keyExtractor={(row) => row.id}
        emptyTitle="No equipment found"
        emptyDescription={
          search || type || customerId
            ? "Try adjusting your filters."
            : "Register your first piece of equipment to get started."
        }
      />
    </div>
  )
}
