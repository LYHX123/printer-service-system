"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, CheckCircle, XCircle, Wallet, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { confirmInvoice, cancelInvoice, deleteInvoice, createSalesLedgerFromInvoice } from "@/lib/actions/invoices"
import type { StockShortfall } from "@/lib/actions/invoices"
import type { InvoiceStatus } from "@/types"

interface InvoiceActionsProps {
  invoiceId: string
  status: InvoiceStatus
  salesLedgerEntryId: string | null
  canEdit: boolean
  canDelete: boolean
  canConfirm: boolean
  canCancel: boolean
  canCreateSalesRecordPerm: boolean
}

type ConfirmTarget = "confirm" | "cancel" | "delete" | null

export function InvoiceActions({
  invoiceId,
  status,
  salesLedgerEntryId,
  canEdit,
  canDelete,
  canConfirm,
  canCancel,
  canCreateSalesRecordPerm,
}: InvoiceActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null)
  const [shortfalls, setShortfalls] = useState<StockShortfall[] | null>(null)
  const [salesRecordPending, setSalesRecordPending] = useState(false)

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmInvoice(invoiceId)
      if ("error" in result) {
        toast.error(result.error)
        if (result.shortfalls?.length) setShortfalls(result.shortfalls)
        return
      }
      toast.success(t("invoiceConfirmed"))
      setConfirmTarget(null)
      setShortfalls(null)
      router.refresh()
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelInvoice(invoiceId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("invoiceCancelled"))
      setConfirmTarget(null)
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteInvoice(invoiceId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("invoiceDeleted"))
      router.push("/quotations/invoices")
    })
  }

  async function handleCreateSalesRecord() {
    setSalesRecordPending(true)
    try {
      const result = await createSalesLedgerFromInvoice(invoiceId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("salesRecordCreated"))
      router.refresh()
    } finally {
      setSalesRecordPending(false)
    }
  }

  const canDeleteNow = canDelete && (status === "DRAFT" || status === "CANCELLED") && !salesLedgerEntryId

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && canConfirm && (
          <Button size="sm" icon={<CheckCircle className="h-3.5 w-3.5" />} onClick={() => setConfirmTarget("confirm")}>
            {t("confirm")}
          </Button>
        )}
        {(status === "DRAFT" || status === "CONFIRMED") && canCancel && (
          <Button size="sm" variant="outline" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setConfirmTarget("cancel")}>
            {t("cancel")}
          </Button>
        )}
        {status === "DRAFT" && canEdit && (
          <Link href={`/quotations/invoices/${invoiceId}/edit`}>
            <Button size="sm" variant="outline" icon={<Pencil className="h-3.5 w-3.5" />}>
              {t("edit")}
            </Button>
          </Link>
        )}
        {canDeleteNow && (
          <Button size="sm" variant="outline" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmTarget("delete")}>
            {t("delete")}
          </Button>
        )}
        {canCreateSalesRecordPerm && (
          salesLedgerEntryId ? (
            <Link href={`/ledger/sales/${salesLedgerEntryId}`}>
              <Button size="sm" variant="outline" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                {t("viewSalesRecord")}
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="outline" icon={<Wallet className="h-3.5 w-3.5" />} loading={salesRecordPending} onClick={handleCreateSalesRecord}>
              {t("createSalesRecord")}
            </Button>
          )
        )}
      </div>

      <Modal
        isOpen={confirmTarget === "confirm"}
        onClose={() => { setConfirmTarget(null); setShortfalls(null) }}
        title={t("confirm")}
        description={t("confirmInvoiceConfirm")}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => { setConfirmTarget(null); setShortfalls(null) }} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button type="button" loading={isPending} onClick={handleConfirm}>
              {t("confirm")}
            </Button>
          </div>
        }
      >
        {shortfalls && shortfalls.length > 0 && (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-red-700">{t("stockShortfallDesc")}</p>
            <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3">
              {shortfalls.map((s) => (
                <li key={s.partId} className="flex justify-between text-red-700">
                  <span>{s.name}</span>
                  <span>{s.have} / {s.need} (-{s.short})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={confirmTarget === "cancel"}
        onClose={() => setConfirmTarget(null)}
        title={t("cancel")}
        description={t("cancelInvoiceConfirm")}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmTarget(null)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" loading={isPending} onClick={handleCancel}>
              {t("confirm")}
            </Button>
          </div>
        }
      >
        <div />
      </Modal>

      <Modal
        isOpen={confirmTarget === "delete"}
        onClose={() => setConfirmTarget(null)}
        title={t("delete")}
        description={t("deleteInvoiceConfirm")}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmTarget(null)} disabled={isPending}>
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
