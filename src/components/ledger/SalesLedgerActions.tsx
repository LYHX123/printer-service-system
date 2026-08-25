"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2, ArchiveRestore } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { setSalesLedgerEntryArchived, deleteSalesLedgerEntry } from "@/lib/actions/ledger"
import { SalesLedgerModal } from "./SalesLedgerModal"
import { AppActionMenu } from "@/components/app-ui/AppActionMenu"
import type { SalesLedgerListItem } from "@/lib/data/ledger"

interface SalesLedgerActionsProps {
  entry: SalesLedgerListItem
  canEdit?: boolean
  canDelete?: boolean
  /** True on the Sales Ledger detail page itself — a View button there would just link to the current page. */
  hideView?: boolean
  /** "menu" renders a compact ⋮ overflow menu instead of the button row — used where the App-mode card itself is already the tap-to-view target, so View is redundant. */
  variant?: "buttons" | "menu"
}

export function SalesLedgerActions({ entry, canEdit = true, canDelete = true, hideView = false, variant = "buttons" }: SalesLedgerActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  function restoreArchived() {
    startTransition(async () => {
      const result = await setSalesLedgerEntryArchived(entry.id, false)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Record restored")
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSalesLedgerEntry(entry.id)
      if (result?.error) {
        toast.error(result.error === "HAS_PAYMENTS" ? t("salesLedgerHasPaymentsError") : result.error)
        return
      }
      toast.success(t("recordDeleted"))
      setConfirmDeleteOpen(false)
      router.refresh()
    })
  }

  if (variant === "menu") {
    return (
      <>
        <AppActionMenu
          ariaLabel={t("actions")}
          items={[
            ...(canEdit ? [{ label: t("edit"), icon: <Pencil />, onClick: () => setEditOpen(true) }] : []),
            ...(entry.isArchived
              ? canEdit
                ? [{ label: t("restoreRecord"), icon: <ArchiveRestore />, onClick: restoreArchived, disabled: isPending }]
                : []
              : canDelete
                ? [{ label: t("delete"), icon: <Trash2 />, onClick: () => setConfirmDeleteOpen(true), destructive: true }]
                : []),
          ]}
        />
        {canEdit && <SalesLedgerModal isOpen={editOpen} onClose={() => setEditOpen(false)} entry={entry} />}
        <Modal
          isOpen={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          title={t("delete")}
          description={t("deleteSalesRecordConfirm")}
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={isPending}>
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

  return (
    <>
      <div className="flex flex-row flex-nowrap items-center justify-end gap-2">
        {!hideView && (
          <Link href={`/ledger/sales/${entry.id}`}>
            <Button variant="outline" size="sm" className="shrink-0 whitespace-nowrap" icon={<Eye className="h-3.5 w-3.5" />}>
              {t("view")}
            </Button>
          </Link>
        )}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => setEditOpen(true)}
          >
            {t("edit")}
          </Button>
        )}
        {entry.isArchived
          ? canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                icon={<ArchiveRestore className="h-3.5 w-3.5" />}
                onClick={restoreArchived}
                loading={isPending}
              >
                {t("restoreRecord")}
              </Button>
            )
          : canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                {t("delete")}
              </Button>
            )}
      </div>
      {canEdit && <SalesLedgerModal isOpen={editOpen} onClose={() => setEditOpen(false)} entry={entry} />}
      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title={t("delete")}
        description={t("deleteSalesRecordConfirm")}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={isPending}>
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
