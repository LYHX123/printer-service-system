"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { LedgerEntryModal } from "./LedgerEntryModal"
import type { LedgerCategory, LedgerEntryType } from "@/types"

export function LedgerAddButtons({ categories }: { categories: LedgerCategory[] }) {
  const { t } = useLanguage()
  const [openType, setOpenType] = useState<LedgerEntryType | null>(null)

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setOpenType("INCOME")}>
          {t("addIncome")}
        </Button>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpenType("EXPENSE")}>
          {t("addExpense")}
        </Button>
      </div>
      {openType && (
        <LedgerEntryModal
          isOpen={Boolean(openType)}
          onClose={() => setOpenType(null)}
          categories={categories}
          defaultType={openType}
        />
      )}
    </>
  )
}
