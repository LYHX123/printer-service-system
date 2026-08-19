import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getDelivery } from "@/lib/data/deliveries"
import { getCustomersWithBranches } from "@/lib/data/customers"
import { getSparePartOptions } from "@/lib/data/inventory"
import { canEditDelivery } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { DeliveryForm } from "@/components/delivery/DeliveryForm"
import { format } from "date-fns"
import type { Role } from "@/types"

export default async function EditDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  if (!canEditDelivery(role, permissions)) redirect("/delivery")
  const { id } = await params
  const companyId = session!.user.companyId as string

  const delivery = await getDelivery(id, companyId)
  if (!delivery) notFound()
  // Once converted to an Invoice, a Delivery's business record must stay put
  // — see the rule documented on updateDelivery in src/lib/actions/deliveries.ts.
  if (delivery.invoiceId) redirect(`/delivery/${id}`)

  const [customers, spareParts] = await Promise.all([
    getCustomersWithBranches(companyId),
    getSparePartOptions(companyId),
  ])

  return (
    <div>
      <Link href={`/delivery/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        {delivery.deliveryNumber}
      </Link>
      <PageHeader title={`Edit ${delivery.deliveryNumber}`} />
      <DeliveryForm
        customers={customers}
        spareParts={spareParts}
        deliveryId={id}
        defaultValues={{
          deliveryDate: format(new Date(delivery.deliveryDate), "yyyy-MM-dd"),
          customerId: delivery.customerId,
          customerBranchId: delivery.customerBranchId ?? "",
          reference: delivery.reference ?? "",
          items: delivery.items.map((item) => ({ partId: item.partId, quantity: item.quantity })),
        }}
      />
    </div>
  )
}
