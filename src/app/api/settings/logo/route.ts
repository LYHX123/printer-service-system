import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageSettings } from "@/lib/permissions"
import { saveCompanyLogo } from "@/lib/uploads"
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_SIZE } from "@/lib/constants"
import type { Role } from "@/types"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canManageSettings(session.user.role as Role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, and WEBP images are allowed" }, { status: 400 })
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const logoUrl = await saveCompanyLogo(companyId, buffer)

  await prisma.company.update({
    where: { id: companyId },
    data: { logoUrl },
  })

  revalidatePath("/settings")

  return NextResponse.json({ logoUrl })
}
