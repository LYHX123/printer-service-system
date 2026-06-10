import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/data/settings"
import { canManageSettings } from "@/lib/permissions"
import { CompanySettingsSchema } from "@/lib/schemas"
import type { Role } from "@/types"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const companyId = session.user.companyId as string

  const settings = await getCompanySettings(companyId)
  if (!settings) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  return NextResponse.json({ settings })
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canManageSettings(session.user.role as Role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const body = await request.json()
  const parsed = CompanySettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 })
  }

  const { name, address, phone, email, website, kraPin, vatPercent, currency, timezone } = parsed.data

  const company = await prisma.company.update({
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

  revalidatePath("/settings")

  return NextResponse.json({ company })
}
