import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getEquipmentForEdit } from "@/lib/data/equipment"
import { getCustomersWithBranches } from "@/lib/data/customers"
import { PageHeader } from "@/components/ui/page-header"
import { EquipmentForm } from "@/components/equipment/EquipmentForm"

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params
  const companyId = session!.user.companyId as string

  const [equipment, customers] = await Promise.all([
    getEquipmentForEdit(id, companyId),
    getCustomersWithBranches(companyId),
  ])

  if (!equipment) notFound()

  const defaultValues = {
    customerId: equipment.customerId,
    branchId: equipment.branchId ?? "",
    type: equipment.type,
    brand: equipment.brand,
    model: equipment.model,
    serialNumber: equipment.serialNumber,
    assetNumber: equipment.assetNumber ?? "",
    purchaseDate: equipment.purchaseDate
      ? new Date(equipment.purchaseDate).toISOString().split("T")[0]
      : "",
    warrantyExpiry: equipment.warrantyExpiry
      ? new Date(equipment.warrantyExpiry).toISOString().split("T")[0]
      : "",
    notes: equipment.notes ?? "",
  }

  return (
    <div>
      <Link
        href={`/equipment/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Equipment
      </Link>
      <PageHeader
        title="Edit Equipment"
        subtitle={`${equipment.brand} ${equipment.model} · ${equipment.serialNumber}`}
      />
      <EquipmentForm
        customers={customers}
        defaultValues={defaultValues}
        equipmentId={id}
      />
    </div>
  )
}
