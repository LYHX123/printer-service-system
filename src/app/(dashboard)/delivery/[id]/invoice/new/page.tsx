import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getDelivery } from "@/lib/data/deliveries"
import { getCustomerOptions } from "@/lib/data/customers"
import { getSparePartOptions } from "@/lib/data/inventory"
import { canConvertDeliveryToInvoice } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { DirectInvoiceForm } from "@/components/quotations/DirectInvoiceForm"
import { GenerateInvoiceFromDeliveryTitle } from "@/components/ui/T"
import type { Role } from "@/types"

/**
 * "Generate Invoice" from a Delivery opens the normal Invoice creation form,
 * pre-populated with the Delivery's customer and items (quantities carried
 * over, partId preserved) — a Delivery Note carries no price, so unit price
 * is left for the user to type here, same as every other Invoice creation
 * path (see DirectInvoiceForm/QuotationForm's addStockItem comment). On
 * submit this posts through createInvoiceFromDelivery (see the
 * `fromDeliveryId` prop on DirectInvoiceForm), which links the resulting
 * Invoice back to this Delivery.
 */
export default async function DeliveryToInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  if (!canConvertDeliveryToInvoice(role, permissions)) redirect("/delivery")
  const { id } = await params
  const companyId = session!.user.companyId as string

  const delivery = await getDelivery(id, companyId)
  if (!delivery) notFound()
  if (delivery.invoiceId) redirect(`/delivery/${id}`)

  const [customers, spareParts] = await Promise.all([
    getCustomerOptions(companyId),
    getSparePartOptions(companyId),
  ])

  return (
    <div>
      <Link href={`/delivery/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        {delivery.deliveryNumber}
      </Link>
      <PageHeader title={<GenerateInvoiceFromDeliveryTitle number={delivery.deliveryNumber} />} />
      <DirectInvoiceForm
        customers={customers}
        spareParts={spareParts}
        fromDeliveryId={id}
        defaultValues={{
          customerId: delivery.customerId,
          items: delivery.items.map((item) => ({ partId: item.partId, quantity: item.quantity, unitPrice: 0 })),
        }}
      />
    </div>
  )
}
