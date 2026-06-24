"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { QuotationStatusBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { QUOTATION_STATUS_LABELS } from "@/types"
import type { QuotationStatus } from "@/types"
import type { QuotationListItem } from "@/lib/data/quotations"
import { ColumnFilterDropdown } from "./ColumnFilterDropdown"

interface QuotationsTableProps {
  quotations: QuotationListItem[]
}

export function QuotationsTable({ quotations }: QuotationsTableProps) {
  const { t } = useLanguage()
  const [numberFilter, setNumberFilter] = useState("")
  const [customerFilter, setCustomerFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [monthFilter, setMonthFilter] = useState("")

  const numberOptions = useMemo(
    () =>
      Array.from(new Set(quotations.map((q) => q.quotationNumber)))
        .sort()
        .map((n) => ({ value: n, label: n })),
    [quotations]
  )

  const customerOptions = useMemo(
    () =>
      Array.from(new Set(quotations.map((q) => q.customer.companyName)))
        .sort()
        .map((n) => ({ value: n, label: n })),
    [quotations]
  )

  const statusOptions = useMemo(
    () =>
      (Object.entries(QUOTATION_STATUS_LABELS) as [QuotationStatus, string][]).map(
        ([value, label]) => ({ value, label })
      ),
    []
  )

  const monthOptions = useMemo(() => {
    const months = Array.from(
      new Set(quotations.map((q) => format(new Date(q.createdAt), "yyyy-MM")))
    ).sort((a, b) => (a < b ? 1 : -1))
    return months.map((m) => ({ value: m, label: format(new Date(`${m}-01`), "MMM yyyy") }))
  }, [quotations])

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      if (numberFilter && q.quotationNumber !== numberFilter) return false
      if (customerFilter && q.customer.companyName !== customerFilter) return false
      if (statusFilter && q.status !== statusFilter) return false
      if (monthFilter && format(new Date(q.createdAt), "yyyy-MM") !== monthFilter) return false
      return true
    })
  }, [quotations, numberFilter, customerFilter, statusFilter, monthFilter])

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ColumnFilterDropdown
                  label={t("quotationNumber")}
                  allLabel="All"
                  options={numberOptions}
                  value={numberFilter}
                  onChange={setNumberFilter}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ColumnFilterDropdown
                  label={t("customer")}
                  allLabel="All"
                  options={customerOptions}
                  value={customerFilter}
                  onChange={setCustomerFilter}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("total")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ColumnFilterDropdown
                  label={t("status")}
                  allLabel="All"
                  options={statusOptions}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ColumnFilterDropdown
                  label={t("date")}
                  allLabel="All"
                  options={monthOptions}
                  value={monthFilter}
                  onChange={setMonthFilter}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                  No quotations match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {q.quotationNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{q.customer.companyName}</div>
                    {q.customer.name && (
                      <div className="text-xs text-slate-500">{q.customer.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">
                    {formatCurrency(Number(q.totalCost))}
                  </td>
                  <td className="px-4 py-3">
                    <QuotationStatusBadge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(q.createdAt), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotations/${q.id}`}
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                    >
                      {t("view")} →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
