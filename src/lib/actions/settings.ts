"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageSettings } from "@/lib/permissions"
import { CompanySettingsSchema } from "@/lib/schemas"
import type { CompanySettingsInput } from "@/lib/schemas"
import type { Role } from "@/types"

export async function updateCompanySettings(data: CompanySettingsInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canManageSettings(session.user.role as Role)) {
    return { error: "You do not have permission to manage company settings" }
  }
  const companyId = session.user.companyId as string

  const parsed = CompanySettingsSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }

  const { name, address, phone, email, website, kraPin, vatPercent, currency, timezone } = parsed.data

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        kraPin: kraPin || null,
        vatPercent,
        currency,
        timezone,
      },
    })
  } catch {
    return { error: "Failed to update company settings" }
  }

  revalidatePath("/settings")
  return { success: true }
}
