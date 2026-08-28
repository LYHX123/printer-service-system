"use client"

import { type InputHTMLAttributes } from "react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { Input } from "@/components/ui/input"
import type { TranslationKey } from "@/lib/i18n/translations"

export function T({ k }: { k: TranslationKey }) {
  const { t } = useLanguage()
  return <>{t(k)}</>
}

export function NoResultsFor({ search }: { search: string }) {
  const { t } = useLanguage()
  return <>{t("noResultsFor").replace("{search}", search)}</>
}

export function GenerateInvoiceFromDeliveryTitle({ number }: { number: string }) {
  const { t } = useLanguage()
  return <>{t("generateInvoiceFromDeliveryTitle").replace("{number}", number)}</>
}

export function TInput({
  // Accepted for backwards compatibility with existing call sites, but no
  // longer rendered — input fields across the system show no placeholder.
  placeholderKey: _placeholderKey,
  ...props
}: { placeholderKey?: TranslationKey } & InputHTMLAttributes<HTMLInputElement>) {
  return <Input {...props} />
}
