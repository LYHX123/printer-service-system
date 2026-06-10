import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomersWithBranches } from "@/lib/data/customers"
import { getAllEquipmentForCompany } from "@/lib/data/equipment"
import { canCreateQuotation } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { QuotationForm } from "@/components/quotations/QuotationForm"
import type { QuotationInput } from "@/lib/schemas"
import type { Role } from "@/types"

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; equipmentId?: string }>
}) {
  const session = await auth()
  if (!canCreateQuotation(session!.user.role as Role)) redirect("/quotations")
  const { customerId, equipmentId } = await searchParams
  const companyId = session!.user.companyId as string

  const [customers, allEquipment] = await Promise.all([
    getCustomersWithBranches(companyId),
    getAllEquipmentForCompany(companyId),
  ])

  const defaultValues: Partial<QuotationInput> = {
    customerId: customerId ?? "",
    equipmentId: equipmentId ?? "",
  }

  return (
    <div>
      <Link
        href="/quotations"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Quotations
      </Link>
      <PageHeader
        title="New Quotation"
        subtitle="Create a quotation for a customer."
      />
      <QuotationForm
        customers={customers}
        allEquipment={allEquipment}
        defaultValues={defaultValues}
      />
    </div>
  )
}
