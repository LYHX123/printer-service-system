import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomersWithBranches } from "@/lib/data/customers"
import { getAllEquipmentForCompany } from "@/lib/data/equipment"
import { getEngineers } from "@/lib/data/jobs"
import { PageHeader } from "@/components/ui/page-header"
import { JobForm } from "@/components/jobs/JobForm"

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; equipmentId?: string }>
}) {
  const session = await auth()
  const { customerId, equipmentId } = await searchParams
  const companyId = session!.user.companyId as string

  const [customers, allEquipment, engineers] = await Promise.all([
    getCustomersWithBranches(companyId),
    getAllEquipmentForCompany(companyId),
    getEngineers(companyId),
  ])

  const defaultValues = {
    ...(customerId ? { customerId } : {}),
    ...(equipmentId ? { equipmentId } : {}),
  }

  return (
    <div>
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Jobs
      </Link>
      <PageHeader title="New Service Job" subtitle="Log a new repair or maintenance request." />
      <JobForm
        customers={customers}
        allEquipment={allEquipment}
        engineers={engineers}
        defaultValues={Object.keys(defaultValues).length > 0 ? defaultValues : undefined}
      />
    </div>
  )
}
