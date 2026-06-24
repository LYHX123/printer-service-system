import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getQuotationForEdit } from "@/lib/data/quotations"
import { getCustomersWithBranches } from "@/lib/data/customers"
import { getSparePartOptions } from "@/lib/data/inventory"
import { canCreateQuotation } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { QuotationForm } from "@/components/quotations/QuotationForm"
import { format } from "date-fns"
import type { QuotationInput } from "@/lib/schemas"
import type { Role } from "@/types"

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!canCreateQuotation(session!.user.role as Role)) redirect("/quotations")
  const { id } = await params
  const companyId = session!.user.companyId as string

  const [quotation, customers, spareParts] = await Promise.all([
    getQuotationForEdit(id, companyId),
    getCustomersWithBranches(companyId),
    getSparePartOptions(companyId),
  ])

  if (!quotation) notFound()

  if (quotation.status !== "DRAFT" && quotation.status !== "SENT") {
    return (
      <div className="text-center py-16 text-slate-500 text-sm">
        Only draft or sent quotations can be edited.{" "}
        <Link href={`/quotations/${id}`} className="text-blue-600 hover:underline">
          View quotation
        </Link>
      </div>
    )
  }

  const defaultValues: QuotationInput = {
    customerId: quotation.customerId,
    validUntil: quotation.validUntil
      ? format(new Date(quotation.validUntil), "yyyy-MM-dd")
      : "",
    vatPercent: Number(quotation.vatPercent),
    remarks: quotation.remarks ?? "",
    internalNotes: quotation.internalNotes ?? "",
    items: quotation.items
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
        href={`/quotations/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        {quotation.quotationNumber}
      </Link>
      <PageHeader
        title="Edit Quotation"
        subtitle={quotation.quotationNumber}
      />
      <QuotationForm
        customers={customers}
        spareParts={spareParts}
        defaultValues={defaultValues}
        quotationId={id}
      />
    </div>
  )
}
