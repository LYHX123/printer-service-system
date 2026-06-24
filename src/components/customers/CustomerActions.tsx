"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Archive, ArchiveRestore } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { setCustomerActive } from "@/lib/actions/customers"

interface CustomerActionsProps {
  customerId: string
  isActive: boolean
}

export function CustomerActions({ customerId, isActive }: CustomerActionsProps) {
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
      <Link href={`/customers/${customerId}/edit`}>
        <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
          Edit
        </Button>
      </Link>
      <Button
        variant="outline"
        size="sm"
        icon={isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
        onClick={toggleActive}
        loading={isPending}
      >
        {isActive ? "Archive" : "Reactivate"}
      </Button>
    </div>
  )
}
