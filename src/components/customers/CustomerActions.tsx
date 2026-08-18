"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Archive, ArchiveRestore } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { setCustomerActive } from "@/lib/actions/customers"

interface CustomerActionsProps {
  customerId: string
  isActive: boolean
  /** Whether the viewer holds customers.edit — gates Edit and Archive/Reactivate (both server-enforced too; this is UI-only). */
  canEdit: boolean
}

export function CustomerActions({ customerId, isActive, canEdit }: CustomerActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()

  function toggleActive() {
    startTransition(async () => {
      const result = await setCustomerActive(customerId, !isActive)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(isActive ? "Customer archived" : "Customer reactivated")
      router.refresh()
    })
  }

  return (
    <div className="flex justify-end gap-2">
      <Link href={`/customers/${customerId}`}>
        <Button variant="outline" size="sm" icon={<Eye className="h-3.5 w-3.5" />}>
          View
        </Button>
      </Link>
      {canEdit && (
        <Link href={`/customers/${customerId}/edit`}>
          <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
            Edit
          </Button>
        </Link>
      )}
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          icon={isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
          onClick={toggleActive}
          loading={isPending}
        >
          {isActive ? "Archive" : "Reactivate"}
        </Button>
      )}
    </div>
  )
}
