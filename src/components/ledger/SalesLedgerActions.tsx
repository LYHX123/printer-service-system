"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Archive, ArchiveRestore } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { setSalesLedgerEntryArchived } from "@/lib/actions/ledger"
import { SalesLedgerModal } from "./SalesLedgerModal"
import type { SalesLedgerListItem } from "@/lib/data/ledger"

export function SalesLedgerActions({ entry }: { entry: SalesLedgerListItem }) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)

  function toggleArchived() {
    startTransition(async () => {
      const result = await setSalesLedgerEntryArchived(entry.id, !entry.isArchived)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(entry.isArchived ? "Record restored" : "Record archived")
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
          icon={entry.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          onClick={toggleArchived}
          loading={isPending}
        >
          {entry.isArchived ? t("restoreRecord") : t("archiveRecord")}
        </Button>
      </div>
      <SalesLedgerModal isOpen={editOpen} onClose={() => setEditOpen(false)} entry={entry} />
    </>
  )
}
