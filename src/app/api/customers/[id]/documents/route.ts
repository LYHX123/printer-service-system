import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess } from "@/lib/permissions"
import { getStorageProvider } from "@/lib/storage"
import { logActivity } from "@/lib/audit"
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE, CUSTOMER_DOCUMENT_TYPES } from "@/lib/constants"
import type { Role } from "@/types"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: customerId } = await params

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  })
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const documentType = formData.get("documentType")
  const projectId = formData.get("projectId")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (
    documentType !== null &&
    documentType !== "" &&
    !CUSTOMER_DOCUMENT_TYPES.includes(documentType as (typeof CUSTOMER_DOCUMENT_TYPES)[number])
  ) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 })
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, WEBP, PDF, and Word documents are allowed" },
      { status: 400 }
    )
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 })
  }

  let resolvedProjectId: string | null = null
  if (typeof projectId === "string" && projectId) {
    const project = await prisma.customerBranch.findFirst({
      where: { id: projectId, customerId },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: "Project not found for this customer" }, { status: 400 })
    }
    resolvedProjectId = project.id
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const provider = getStorageProvider("LOCAL")
  const saved = await provider.save({
    scopePath: `customers/${customerId}/documents`,
    buffer,
    originalFileName: file.name,
  })

  try {
    const document = await prisma.customerDocument.create({
      data: {
        companyId,
        customerId,
        projectId: resolvedProjectId,
        documentType: typeof documentType === "string" && documentType ? documentType : null,
        originalFileName: file.name,
        storageKey: saved.storageKey,
        storageProvider: "LOCAL",
        mimeType: file.type,
        fileSize: saved.fileSize,
        uploadedById: session.user.id as string,
      },
      include: { uploadedBy: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    })

    await logActivity({
      companyId,
      entityType: "CustomerDocument",
      entityId: document.id,
      action: "UPLOADED",
      performedById: session.user.id as string,
      metadata: { customerId, fileName: file.name },
    })

    revalidatePath(`/customers/${customerId}`)
    return NextResponse.json({ document: { ...document, url: provider.getUrl(document.storageKey) } })
  } catch (err) {
    // DB write failed after a successful disk write — don't leave an orphan file.
    await provider.delete(saved.storageKey).catch(() => {})
    console.error(err)
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 })
  }
}
