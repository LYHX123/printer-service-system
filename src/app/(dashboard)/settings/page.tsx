import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCompanySettings } from "@/lib/data/settings"
import { canManageSettings } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm"
import type { Role } from "@/types"

export default async function SettingsPage() {
  const session = await auth()
  const role = session!.user.role as Role
  if (!canManageSettings(role)) {
    redirect("/dashboard")
  }

  const companyId = session!.user.companyId as string
  const company = await getCompanySettings(companyId)
  if (!company) redirect("/dashboard")

  return (
    <div>
      <PageHeader
        title="Company Settings"
        subtitle="Manage your company profile, branding, and regional preferences."
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
    </div>
  )
}
