"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
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
  const { t } = useLanguage()
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
      toast.success(t("deliveryDeletedToast"))
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-nowrap items-center justify-end gap-1.5">
        <Link href={`/delivery/${deliveryId}`} title={t("view")}>
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label={t("view")}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </Link>
        {canEditNow && (
          <Link href={`/delivery/${deliveryId}/edit`} title={t("edit")}>
            <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label={t("edit")}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}
        {canDeleteNow && (
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label={t("delete")} title={t("delete")} onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {/* Desktop-only component (see delivery/page.tsx — only rendered in the
            non-app-mode table view) — no target="_blank" needed: DownloadGuard,
            which is what actually needs it, never mounts on desktop. */}
        <a href={`/api/delivery/${deliveryId}/excel`} title={t("downloadExcel")}>
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label={t("downloadExcel")}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </Button>
        </a>
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
