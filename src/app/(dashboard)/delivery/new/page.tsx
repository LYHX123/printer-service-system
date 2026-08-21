import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomersWithBranches } from "@/lib/data/customers"
import { getSparePartOptions } from "@/lib/data/inventory"
import { canCreateDelivery } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { DeliveryForm } from "@/components/delivery/DeliveryForm"
import { T } from "@/components/ui/T"
import type { Role } from "@/types"

export default async function NewDeliveryPage() {
  const session = await auth()
  if (!canCreateDelivery(session!.user.role as Role, session!.user.modulePermissions)) redirect("/delivery")
  const companyId = session!.user.companyId as string

  const [customers, spareParts] = await Promise.all([
    getCustomersWithBranches(companyId),
    getSparePartOptions(companyId),
  ])

  return (
    <div>
      <Link href="/delivery" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="delivery" />
      </Link>
      <PageHeader title={<T k="createDelivery" />} />
      <DeliveryForm customers={customers} spareParts={spareParts} />
    </div>
  )
}
