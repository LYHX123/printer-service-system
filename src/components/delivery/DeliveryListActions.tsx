"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { deleteDelivery } from "@/lib/actions/deliveries"

interface DeliveryListActionsProps {
  deliveryId: string
  hasInvoice: boolean
  canEdit: boolean
  canDelete: boolean
}

export function DeliveryListActions({ deliveryId, hasInvoice, canEdit, canDelete }: DeliveryListActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const canEditNow = canEdit && !hasInvoice
  const canDeleteNow = canDelete && !hasInvoice

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDelivery(deliveryId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Delivery deleted")
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-nowrap items-center justify-end gap-1.5">
        <Link href={`/delivery/${deliveryId}`} title="View">
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label="View">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </Link>
        {canEditNow && (
          <Link href={`/delivery/${deliveryId}/edit`} title="Edit">
            <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}
        {canDeleteNow && (
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label="Delete" title="Delete" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <a href={`/api/delivery/${deliveryId}/excel`} title="Download Excel">
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label="Download Excel">
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </Button>
        </a>
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete Delivery"
        description="This will permanently delete this delivery and restore the stock quantities it deducted. This cannot be undone."
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" loading={isPending} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <div />
      </Modal>
    </>
  )
}
