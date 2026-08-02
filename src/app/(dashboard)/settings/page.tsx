import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCompanySettings } from "@/lib/data/settings"
import { canManageSettings } from "@/lib/permissions"
import { getDropboxConnectionStatus } from "@/lib/dropbox"
import { PageHeader } from "@/components/ui/page-header"
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm"
import { DropboxIntegrationCard } from "@/components/settings/DropboxIntegrationCard"
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
    </div>
  )
}
