"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { SalesLedgerModal } from "./SalesLedgerModal"

export function SalesLedgerAddButton() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        {t("addSalesRecord")}
      </Button>
      <SalesLedgerModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}
