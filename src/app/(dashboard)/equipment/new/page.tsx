import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomersWithBranches } from "@/lib/data/customers"
import { PageHeader } from "@/components/ui/page-header"
import { EquipmentForm } from "@/components/equipment/EquipmentForm"

export default async function NewEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const session = await auth()
  const { customerId } = await searchParams
  const companyId = session!.user.companyId as string

  const customers = await getCustomersWithBranches(companyId)

  return (
    <div>
      <Link href="/equipment" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Equipment
      </Link>
      <PageHeader title="Register Equipment" subtitle="Add a new device to the equipment registry." />
      <EquipmentForm
        customers={customers}
        defaultValues={customerId ? { customerId } : undefined}
      />
    </div>
  )
}
