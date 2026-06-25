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
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setOpenType("INCOME")}
          className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
        >
          {t("addIncome")}
        </Button>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setOpenType("EXPENSE")}
          className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
        >
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
