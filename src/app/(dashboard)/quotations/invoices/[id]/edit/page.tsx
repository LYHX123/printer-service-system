import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { getInvoice } from "@/lib/data/invoices"
import { getCustomerOptions } from "@/lib/data/customers"
import { getSparePartOptions } from "@/lib/data/inventory"
import { canEditInvoice } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { DirectInvoiceForm } from "@/components/quotations/DirectInvoiceForm"
import type { DirectInvoiceInput } from "@/lib/schemas"
import type { Role } from "@/types"

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  if (!canEditInvoice(role, permissions)) redirect("/quotations/invoices")
  const { id } = await params
  const companyId = session!.user.companyId as string

  const [invoice, customers, spareParts] = await Promise.all([
    getInvoice(id, companyId),
    getCustomerOptions(companyId),
    getSparePartOptions(companyId),
  ])

  if (!invoice) notFound()

  if (invoice.status !== "DRAFT") {
    return (
      <div className="text-center py-16 text-slate-500 text-sm">
        Only draft invoices can be edited.{" "}
        <Link href={`/quotations/invoices/${id}`} className="text-blue-600 hover:underline">
          View invoice
        </Link>
      </div>
    )
  }

  const defaultValues: DirectInvoiceInput = {
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerPin: invoice.customerPin ?? "",
    date: format(new Date(invoice.date), "yyyy-MM-dd"),
    vatPercent: Number(invoice.vatPercent),
    remarks: invoice.remarks ?? "",
    items: invoice.items
      .filter((item) => item.partId)
      .map((item) => ({
        partId: item.partId!,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
  }

  return (
    <div>
      <Link
        href={`/quotations/invoices/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        {invoice.invoiceNumber}
      </Link>
      <PageHeader title={`Edit ${invoice.invoiceNumber}`} />
      <DirectInvoiceForm customers={customers} spareParts={spareParts} defaultValues={defaultValues} invoiceId={id} />
    </div>
  )
}
