import Link from "next/link"
import { redirect } from "next/navigation"
import { ScrollText, ChevronRight } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCompanySettings } from "@/lib/data/settings"
import { canManageSettings } from "@/lib/permissions"
import { getDropboxConnectionStatus } from "@/lib/dropbox"
import { PageHeader } from "@/components/ui/page-header"
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm"
import { DropboxIntegrationCard } from "@/components/settings/DropboxIntegrationCard"
import { SystemInitializationPanel } from "@/components/settings/SystemInitializationPanel"
import { T } from "@/components/ui/T"
import type { Role } from "@/types"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ dropboxConnected?: string; dropboxError?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  if (!canManageSettings(role)) {
    redirect("/dashboard")
  }

  const companyId = session!.user.companyId as string
  const company = await getCompanySettings(companyId)
  if (!company) redirect("/dashboard")

  const { dropboxConnected, dropboxError } = await searchParams
  const dropboxStatus = await getDropboxConnectionStatus(companyId)
  const dropboxToast = dropboxError
    ? ({ type: "error", message: dropboxError } as const)
    : dropboxConnected
      ? ({ type: "success", message: "Dropbox connected" } as const)
      : null

  return (
    <div className="space-y-5">
      <PageHeader
        title={<T k="companySettings" />}
        subtitle={<T k="companySettingsDesc" />}
      />
      <CompanySettingsForm
        defaultValues={{
          name: company.name,
          address: company.address ?? "",
          phone: company.phone ?? "",
          email: company.email ?? "",
          website: company.website ?? "",
          kraPin: company.kraPin ?? "",
          vatPercent: Number(company.vatPercent),
          currency: company.currency,
          timezone: company.timezone,
        }}
        logoUrl={company.logoUrl}
      />
      <DropboxIntegrationCard status={dropboxStatus} initialToast={dropboxToast} />
      {/* Audit Log is strictly Admin-only — same rule as System Initialization
          below. The page itself (/settings/audit-log) re-checks role === "ADMIN"
          server-side and never trusts this render gate as the real boundary. */}
      {role === "ADMIN" && (
        <Link
          href="/settings/audit-log"
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <ScrollText className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900"><T k="auditLog" /></p>
              <p className="text-xs text-slate-500"><T k="auditLogCardDesc" /></p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>
      )}
      {/* System Initialization is strictly Admin-only — never shown to a
          non-admin even if they hold settings.edit, since it's a distinct,
          higher-stakes action than ordinary company-settings editing. The
          server action (src/lib/actions/systemInit.ts) re-checks role
          itself and never trusts this render gate as the real boundary. */}
      {role === "ADMIN" && <SystemInitializationPanel isProduction={process.env.NODE_ENV === "production"} />}
    </div>
  )
}
