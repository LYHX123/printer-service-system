"use client"

import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/i18n/LanguageContext"

// Shared by the Tasks list rows (desktop + App-mode cards) and
// TaskDetailPanel — one definition so status wording/color can never drift
// between the list and the detail view.
export function TaskStatusBadge({ status }: { status: "ACTIVE" | "COMPLETED" }) {
  const { t } = useLanguage()
  return status === "COMPLETED" ? (
    <Badge className="bg-emerald-100 text-emerald-700">{t("taskStatusCompleted")}</Badge>
  ) : (
    <Badge className="bg-blue-100 text-blue-700">{t("taskStatusActive")}</Badge>
  )
}
