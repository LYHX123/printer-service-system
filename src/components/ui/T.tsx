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

export function TInput({
  placeholderKey,
  ...props
}: { placeholderKey: TranslationKey } & InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useLanguage()
  return <Input placeholder={t(placeholderKey)} {...props} />
}
