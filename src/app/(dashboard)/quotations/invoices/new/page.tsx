import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomerOptions } from "@/lib/data/customers"
import { getSparePartOptions } from "@/lib/data/inventory"
import { canCreateInvoice } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { DirectInvoiceForm } from "@/components/quotations/DirectInvoiceForm"
import { T } from "@/components/ui/T"
import type { Role } from "@/types"

export default async function NewDirectInvoicePage() {
  const session = await auth()
  if (!canCreateInvoice(session!.user.role as Role, session!.user.modulePermissions)) redirect("/quotations/invoices")
  const companyId = session!.user.companyId as string

  const [customers, spareParts] = await Promise.all([
    getCustomerOptions(companyId),
    getSparePartOptions(companyId),
  ])

  return (
    <div>
      <Link
        href="/quotations/invoices"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        <T k="invoices" />
      </Link>
      <PageHeader title={<T k="createInvoice" />} />
      <DirectInvoiceForm customers={customers} spareParts={spareParts} />
    </div>
  )
}
