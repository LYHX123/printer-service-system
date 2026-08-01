"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { deleteShopAccountEntry } from "@/lib/actions/shopAccount"
import { ShopAccountEntryModal } from "./ShopAccountEntryModal"
import type { ShopAccountCategory } from "@/types"
import type { ShopAccountEntryWithRelations } from "@/lib/data/shopAccount"

interface ShopAccountEntryActionsProps {
  entry: ShopAccountEntryWithRelations
  categories: ShopAccountCategory[]
  canEdit: boolean
  canDelete: boolean
}

export function ShopAccountEntryActions({ entry, categories, canEdit, canDelete }: ShopAccountEntryActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteShopAccountEntry(entry.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(t("recordDeleted"))
      setConfirmOpen(false)
      router.refresh()
    })
  }

  if (!canEdit && !canDelete) return null

  return (
    <>
      <div className="flex flex-nowrap items-center justify-end gap-2">
        {canEdit && (
          <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditOpen(true)}>
            {t("edit")}
          </Button>
        )}
        {canDelete && (
          <Button variant="outline" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmOpen(true)}>
            {t("delete")}
          </Button>
        )}
      </div>
      {canEdit && (
        <ShopAccountEntryModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          categories={categories}
          defaultType={entry.type}
          entry={entry}
        />
      )}
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
