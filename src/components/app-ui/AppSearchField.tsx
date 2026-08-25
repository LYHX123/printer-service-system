"use client"

import { Search } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { Input } from "@/components/ui/input"
import type { TranslationKey } from "@/lib/i18n/translations"

interface AppSearchFieldProps {
  name: string
  placeholderKey: TranslationKey
  defaultValue?: string
}

// Compact search input for App-mode list headers (Customers, Stock, ...).
// Submitted via the same plain GET <form> the desktop search bars already
// use, so search logic itself is never duplicated — this only owns the
// compact icon+field presentation.
export function AppSearchField({ name, placeholderKey, defaultValue }: AppSearchFieldProps) {
  const { t } = useLanguage()
  return (
    <Input
      name={name}
      type="search"
      placeholder={t(placeholderKey)}
      defaultValue={defaultValue}
      icon={<Search className="h-4 w-4" />}
      className="h-11 rounded-xl"
    />
  )
}
