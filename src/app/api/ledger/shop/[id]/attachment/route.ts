import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditLedgerEntryPerm } from "@/lib/permissions"
import { getStorageProvider } from "@/lib/storage"
import { deleteShopAccountAttachment } from "@/lib/uploads"
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE } from "@/lib/constants"
import type { Role } from "@/types"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canEditLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "shop")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const { id } = await params
  const entry = await prisma.shopAccountEntry.findFirst({ where: { id, companyId } })
  if (!entry) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WEBP, and PDF files are allowed" }, { status: 400 })
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 })
  }

  // Replacing an existing attachment — remove the old file first.
  if (entry.attachmentUrl) {
    await deleteShopAccountAttachment(entry.attachmentUrl)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const provider = getStorageProvider("LOCAL")
  const saved = await provider.save({
    scopePath: `shop-account/${id}`,
    buffer,
    originalFileName: file.name,
  })
  const attachmentUrl = provider.getUrl(saved.storageKey)

  await prisma.shopAccountEntry.update({
    where: { id },
    data: { attachmentUrl, attachmentFileName: file.name, attachmentMimeType: file.type },
  })

  revalidatePath("/ledger/shop")

  return NextResponse.json({ attachmentUrl, attachmentFileName: file.name, attachmentMimeType: file.type })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canEditLedgerEntryPerm(session.user.role as Role, session.user.modulePermissions, "shop")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string

  const { id } = await params
  const entry = await prisma.shopAccountEntry.findFirst({ where: { id, companyId } })
  if (!entry) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }

  if (entry.attachmentUrl) {
    await deleteShopAccountAttachment(entry.attachmentUrl)
  }

  await prisma.shopAccountEntry.update({
    where: { id },
    data: { attachmentUrl: null, attachmentFileName: null, attachmentMimeType: null },
  })

  revalidatePath("/ledger/shop")

  return NextResponse.json({ success: true })
}
