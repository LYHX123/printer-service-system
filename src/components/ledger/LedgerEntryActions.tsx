"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { deleteLedgerEntry } from "@/lib/actions/ledger"
import { LedgerEntryModal } from "./LedgerEntryModal"
import type { LedgerCategory, LedgerEntryWithRelations } from "@/types"

interface LedgerEntryActionsProps {
  entry: LedgerEntryWithRelations
  categories: LedgerCategory[]
}

export function LedgerEntryActions({ entry, categories }: LedgerEntryActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteLedgerEntry(entry.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Record deleted")
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditOpen(true)}>
          {t("edit")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() => setConfirmOpen(true)}
        >
          {t("delete")}
        </Button>
      </div>
      <LedgerEntryModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        categories={categories}
        defaultType={entry.type}
        entry={entry}
      />
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("delete")}
        description={t("deleteEntryConfirm")}
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
