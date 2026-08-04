"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Table, type Column } from "@/components/ui/table"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { T } from "@/components/ui/T"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export interface AuditLogRow {
  id: string
  createdAt: string
  entityType: string
  entityId: string
  action: string
  performedByName: string
  metadata: Record<string, unknown> | null
  summary: string
}

/** "quotationNumber" -> "Quotation Number" — used only for the detail modal's key/value list. */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map((v) => formatMetadataValue(v)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function DetailModal({ row, onClose }: { row: AuditLogRow; onClose: () => void }) {
  const { t } = useLanguage()
  const metadataEntries = row.metadata ? Object.entries(row.metadata) : []

  return (
    <Modal isOpen onClose={onClose} title={t("auditLogDetailTitle")} size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{row.summary}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-slate-100 pt-3">
          <dt className="text-slate-500">{t("auditLogColumnTime")}</dt>
          <dd className="text-slate-900">{format(new Date(row.createdAt), "dd MMM yyyy, HH:mm:ss")}</dd>
          <dt className="text-slate-500">{t("auditLogColumnUser")}</dt>
          <dd className="text-slate-900">{row.performedByName}</dd>
          <dt className="text-slate-500">{t("auditLogColumnModule")}</dt>
          <dd className="text-slate-900">{row.entityType}</dd>
          <dt className="text-slate-500">{t("auditLogColumnAction")}</dt>
          <dd className="text-slate-900">{row.action}</dd>
        </dl>

        <div className="border-t border-slate-100 pt-3">
          {metadataEntries.length === 0 ? (
            <p className="text-sm text-slate-400 italic">{t("auditLogNoDetails")}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {metadataEntries.map(([key, value]) => (
                <Fragment key={key}>
                  <dt className="text-slate-500">{humanizeKey(key)}</dt>
                  <dd className="text-slate-900 break-words">{formatMetadataValue(value)}</dd>
                </Fragment>
              ))}
            </dl>
          )}
        </div>
      </div>
    </Modal>
  )
}

interface AuditLogExplorerProps {
  rows: AuditLogRow[]
  total: number
  page: number
  totalPages: number
  prevHref: string
  nextHref: string
}

export function AuditLogExplorer({ rows, total, page, totalPages, prevHref, nextHref }: AuditLogExplorerProps) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState<AuditLogRow | null>(null)

  const columns: Column<AuditLogRow>[] = [
    {
      key: "createdAt",
      label: <T k="auditLogColumnTime" />,
      render: (row) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {format(new Date(row.createdAt), "dd MMM yyyy, HH:mm")}
        </span>
      ),
    },
    {
      key: "performedByName",
      label: <T k="auditLogColumnUser" />,
      render: (row) => <span className="text-sm font-medium text-slate-900">{row.performedByName}</span>,
    },
    {
      key: "entityType",
      label: <T k="auditLogColumnModule" />,
      render: (row) => (
        <Badge className="bg-slate-100 text-slate-600">{row.entityType}</Badge>
      ),
    },
    {
      key: "action",
      label: <T k="auditLogColumnAction" />,
      render: (row) => <span className="text-xs font-mono text-slate-500">{row.action}</span>,
    },
    {
      key: "summary",
      label: <T k="auditLogColumnSummary" />,
      render: (row) => <span className="text-sm text-slate-700">{row.summary}</span>,
    },
  ]

  return (
    <>
      <Table
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => setSelected(row)}
        emptyTitle={<T k="auditLogEmptyTitle" />}
        emptyDescription={<T k="auditLogEmptyDesc" />}
      />

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-slate-500">{t("auditLogTotalResults").replace("{count}", String(total))}</p>
        <div className="flex items-center gap-2">
          <Link href={prevHref} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
            <Button type="button" variant="outline" size="sm" disabled={page <= 1}>
              <T k="auditLogPrevious" />
            </Button>
          </Link>
          <span className="text-xs text-slate-500">
            {t("auditLogPageInfo").replace("{page}", String(page)).replace("{totalPages}", String(totalPages))}
          </span>
          <Link href={nextHref} aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined}>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages}>
              <T k="auditLogNext" />
            </Button>
          </Link>
        </div>
      </div>

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
