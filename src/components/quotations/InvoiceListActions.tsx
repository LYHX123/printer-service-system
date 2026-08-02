"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { deleteInvoice } from "@/lib/actions/invoices"
import type { InvoiceStatus } from "@/types"

interface InvoiceListActionsProps {
  invoiceId: string
  status: InvoiceStatus
  hasSalesLedgerEntry: boolean
  canEdit: boolean
  canDelete: boolean
}

export function InvoiceListActions({ invoiceId, status, hasSalesLedgerEntry, canEdit, canDelete }: InvoiceListActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const canDeleteNow = canDelete && (status === "DRAFT" || status === "CANCELLED") && !hasSalesLedgerEntry

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteInvoice(invoiceId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("invoiceDeleted"))
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-nowrap items-center justify-end gap-1.5">
        <Link href={`/quotations/invoices/${invoiceId}`} title="View">
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label="View">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </Link>
        {status === "DRAFT" && canEdit && (
          <Link href={`/quotations/invoices/${invoiceId}/edit`} title={t("edit")}>
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
        <a href={`/api/quotations/invoices/${invoiceId}/excel`} title={t("downloadExcel")}>
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label={t("downloadExcel")}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </Button>
        </a>
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("delete")}
        description={t("deleteInvoiceConfirm")}
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
