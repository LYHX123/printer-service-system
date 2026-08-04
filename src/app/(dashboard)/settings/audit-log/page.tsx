import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getAuditLogs, getAuditLogFilterOptions } from "@/lib/data/audit"
import { formatAuditSummary } from "@/lib/auditFormat"
import { PageHeader } from "@/components/ui/page-header"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TInput, T } from "@/components/ui/T"
import { AuditLogExplorer, type AuditLogRow } from "@/components/settings/AuditLogExplorer"
import type { Role } from "@/types"

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string
    to?: string
    userId?: string
    entityType?: string
    action?: string
    search?: string
    page?: string
  }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  // Strictly Admin-only — never permission-leaf-based, same rule as System
  // Initialization. The Audit Log is a higher-stakes, cross-module view than
  // ordinary Settings access, so a non-admin holding settings.* must not see it.
  if (role !== "ADMIN") redirect("/dashboard")

  const companyId = session!.user.companyId as string
  const { from, to, userId, entityType, action, search, page } = await searchParams
  const pageNum = page ? Math.max(1, parseInt(page, 10) || 1) : 1

  const [logPage, filterOptions] = await Promise.all([
    getAuditLogs(companyId, { from, to, userId, entityType, action, search, page: pageNum }),
    getAuditLogFilterOptions(companyId),
  ])

  const rows: AuditLogRow[] = logPage.entries.map((entry) => ({
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    performedByName: entry.performedBy.name,
    metadata: entry.metadata,
    summary: formatAuditSummary({
      entityType: entry.entityType,
      action: entry.action,
      entityId: entry.entityId,
      metadata: entry.metadata,
      performedByName: entry.performedBy.name,
    }),
  }))

  const hasFilters = Boolean(from || to || userId || entityType || action || search)

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (userId) params.set("userId", userId)
    if (entityType) params.set("entityType", entityType)
    if (action) params.set("action", action)
    if (search) params.set("search", search)
    params.set("page", String(targetPage))
    return `/settings/audit-log?${params.toString()}`
  }

  return (
    <div>
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="companySettings" />
      </Link>

      <PageHeader title={<T k="auditLog" />} subtitle={<T k="auditLogDesc" />} />

      <form method="GET" className="filter-bar flex flex-wrap items-center gap-2 mb-4">
        <TInput name="search" type="search" placeholderKey="auditLogSearchPlaceholder" defaultValue={search ?? ""} className="w-64" />
        <Select name="userId" defaultValue={userId ?? ""} className="w-44">
          <option value=""><T k="auditLogAllUsers" /></option>
          {filterOptions.users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </Select>
        <Select name="entityType" defaultValue={entityType ?? ""} className="w-40">
          <option value=""><T k="auditLogAllModules" /></option>
          {filterOptions.entityTypes.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </Select>
        <Select name="action" defaultValue={action ?? ""} className="w-40">
          <option value=""><T k="auditLogAllActions" /></option>
          {filterOptions.actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
        <label className="text-xs text-slate-500"><T k="fromDate" /></label>
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-40" />
        <label className="text-xs text-slate-500"><T k="toDate" /></label>
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-40" />
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {hasFilters && (
          <Link href="/settings/audit-log">
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
      </form>

      <AuditLogExplorer
        rows={rows}
        total={logPage.total}
        page={logPage.page}
        totalPages={logPage.totalPages}
        prevHref={pageHref(Math.max(1, logPage.page - 1))}
        nextHref={pageHref(Math.min(logPage.totalPages, logPage.page + 1))}
      />
    </div>
  )
}
