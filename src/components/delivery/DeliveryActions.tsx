"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Receipt, ArrowRight, CloudUpload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { deleteDelivery, resyncDeliveryDropbox } from "@/lib/actions/deliveries"

interface DeliveryActionsProps {
  deliveryId: string
  invoice: { id: string; invoiceNumber: string } | null
  canEdit: boolean
  canDelete: boolean
  canConvertToInvoice: boolean
  /** True when this delivery's XLSX and/or PDF is missing from Dropbox — shows the "Sync to Dropbox" retry button. */
  needsDropboxSync: boolean
  canSyncDropbox: boolean
}

export function DeliveryActions({
  deliveryId,
  invoice,
  canEdit,
  canDelete,
  canConvertToInvoice,
  needsDropboxSync,
  canSyncDropbox,
}: DeliveryActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Once a Delivery has been converted to an Invoice, its business record
  // must stay put — see the rule documented on deleteDelivery/updateDelivery
  // in src/lib/actions/deliveries.ts.
  const canEditNow = canEdit && !invoice
  const canDeleteNow = canDelete && !invoice

  async function handleSync() {
    setIsSyncing(true)
    try {
      const result = await resyncDeliveryDropbox(deliveryId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("syncedToDropboxToast"))
      router.refresh()
    } finally {
      setIsSyncing(false)
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDelivery(deliveryId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("deliveryDeletedToast"))
      router.push("/delivery")
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canSyncDropbox && needsDropboxSync && (
          <Button size="sm" variant="outline" icon={<CloudUpload className="h-3.5 w-3.5" />} loading={isSyncing} onClick={handleSync}>
            {t("syncToDropbox")}
          </Button>
        )}
        {canEditNow && (
          <Link href={`/delivery/${deliveryId}/edit`}>
            <Button size="sm" variant="outline" icon={<Pencil className="h-3.5 w-3.5" />}>
              {t("edit")}
            </Button>
          </Link>
        )}
        {canDeleteNow && (
          <Button size="sm" variant="outline" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmOpen(true)}>
            {t("delete")}
          </Button>
        )}
        {canConvertToInvoice &&
          (invoice ? (
            <Link href={`/quotations/invoices/${invoice.id}`}>
              <Button size="sm" variant="outline" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                {t("viewInvoice")}
              </Button>
            </Link>
          ) : (
            <Link href={`/delivery/${deliveryId}/invoice/new`}>
              <Button size="sm" icon={<Receipt className="h-3.5 w-3.5" />}>
                {t("generateInvoice")}
              </Button>
            </Link>
          ))}
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("deleteDeliveryTitle")}
        description={t("deleteDeliveryConfirmDesc")}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" loading={isPending} onClick={handleDelete}>
              {t("delete")}
            </Button>
          </div>
        }
      >
        <div />
      </Modal>
    </>
  )
}
