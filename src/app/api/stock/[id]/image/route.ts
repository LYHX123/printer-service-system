import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditStock } from "@/lib/permissions"
import { saveSparePartImage, deleteSparePartImage } from "@/lib/uploads"
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_SIZE } from "@/lib/constants"
import { categoryToBucket } from "@/lib/stock-types"
import type { Role } from "@/types"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const companyId = session.user.companyId as string

  const { id } = await params
  const part = await prisma.sparePart.findFirst({ where: { id, companyId } })
  if (!part) {
    return NextResponse.json({ error: "Part not found" }, { status: 404 })
  }
  if (!canEditStock(session.user.role as Role, session.user.modulePermissions, categoryToBucket(part.category))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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
  const imageUrl = await saveSparePartImage(id, buffer)

  await prisma.sparePart.update({
    where: { id },
    data: { imageUrl },
  })

  revalidatePath(`/stock/${id}/edit`)
  revalidatePath("/stock")

  return NextResponse.json({ imageUrl })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const companyId = session.user.companyId as string

  const { id } = await params
  const part = await prisma.sparePart.findFirst({ where: { id, companyId } })
  if (!part) {
    return NextResponse.json({ error: "Part not found" }, { status: 404 })
  }
  if (!canEditStock(session.user.role as Role, session.user.modulePermissions, categoryToBucket(part.category))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (part.imageUrl) {
    await deleteSparePartImage(part.imageUrl)
  }

  await prisma.sparePart.update({ where: { id }, data: { imageUrl: null } })

  revalidatePath(`/stock/${id}/edit`)
  revalidatePath("/stock")

  return NextResponse.json({ success: true })
}
