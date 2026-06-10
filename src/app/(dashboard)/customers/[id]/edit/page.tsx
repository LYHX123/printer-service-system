import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomerForEdit } from "@/lib/data/customers"
import { PageHeader } from "@/components/ui/page-header"
import { CustomerForm } from "@/components/customers/CustomerForm"

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params
  const companyId = session!.user.companyId as string

  const customer = await getCustomerForEdit(id, companyId)
  if (!customer) notFound()

  return (
    <div>
      <Link href={`/customers/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Customer
      </Link>
      <PageHeader title="Edit Customer" subtitle={customer.name} />
      <CustomerForm
        customerId={id}
        defaultValues={{
          name: customer.name,
          companyName: customer.companyName ?? "",
          phone: customer.phone,
          email: customer.email ?? "",
          address: customer.address ?? "",
        }}
      />
    </div>
  )
}
