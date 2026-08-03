import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess, canUploadCustomerFile } from "@/lib/permissions"
import { getStorageProvider } from "@/lib/storage"
import { logActivity } from "@/lib/audit"
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE, CUSTOMER_DOCUMENT_TYPES, isStandardDocumentType, dropboxFileNameFor } from "@/lib/constants"
import { getDropboxConnectionStatus, deleteCustomerDocumentFromDropbox, DropboxError } from "@/lib/dropbox"
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
  if (!canAccess(role, "customers", permissions) || !canUploadCustomerFile(role, permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: customerId } = await params

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true, shortName: true },
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
    typeof documentType !== "string" ||
    !documentType ||
    !CUSTOMER_DOCUMENT_TYPES.includes(documentType as (typeof CUSTOMER_DOCUMENT_TYPES)[number])
  ) {
    return NextResponse.json({ error: "Document type is required" }, { status: 400 })
  }
  const resolvedDocumentType = documentType as (typeof CUSTOMER_DOCUMENT_TYPES)[number]
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

  // Customer Documents are Dropbox-backed going forward (Phase 2) — both
  // preconditions are checked up front so a missing prerequisite comes back
  // as a clear 400 rather than a confusing failure deeper in the upload.
  const dropboxStatus = await getDropboxConnectionStatus(companyId)
  if (!dropboxStatus.configured || !dropboxStatus.connected) {
    return NextResponse.json(
      { error: "Dropbox is not connected. Connect it in Settings before uploading customer documents." },
      { status: 400 }
    )
  }
  if (!customer.shortName?.trim()) {
    return NextResponse.json(
      { error: "This customer has no Short Name yet. Edit the customer to add one before uploading documents." },
      { status: 400 }
    )
  }

  const standard = isStandardDocumentType(resolvedDocumentType)
  const dropboxFileName = dropboxFileNameFor(resolvedDocumentType, file.name)

  // For a standard type, a Customer keeps at most one *current* file — look
  // up that row BEFORE uploading so an extension change (e.g. a prior
  // "PIN Certificate.pdf" replaced by a new "PIN Certificate.jpg") can be
  // detected: the new file lands at a different Dropbox path, so the old
  // one has to be cleaned up separately afterward instead of just being
  // overwritten in place.
  const priorStandardRow = standard
    ? await prisma.customerDocument.findFirst({
        where: { customerId, storageProvider: "DROPBOX", documentType: resolvedDocumentType },
        select: { id: true, storageKey: true },
      })
    : null

  const buffer = Buffer.from(await file.arrayBuffer())
  const provider = getStorageProvider("DROPBOX", companyId)

  let saved: { storageKey: string; fileSize: number }
  try {
    saved = await provider.save({
      scopePath: customer.shortName,
      buffer,
      originalFileName: dropboxFileName,
    })
  } catch (error) {
    console.error("Customer document Dropbox upload failed:", error)
    return NextResponse.json(
      { error: error instanceof DropboxError ? error.message : "Failed to upload document to Dropbox" },
      { status: 502 }
    )
  }

  if (priorStandardRow && priorStandardRow.storageKey !== saved.storageKey) {
    // Extension changed — the previous file is now an orphaned second "current"
    // copy at a different path. Best-effort cleanup only: the new file is
    // already safely uploaded and the DB record is updated regardless of
    // whether this succeeds.
    try {
      await deleteCustomerDocumentFromDropbox(companyId, priorStandardRow.storageKey)
    } catch (error) {
      console.error("Failed to remove superseded Dropbox file:", priorStandardRow.storageKey, error)
    }
  }

  try {
    // Non-standard types (OTHER, CONTRACT, ...) keep the original filename as
    // the Dropbox filename, so a same-name re-upload lands at the same
    // deterministic path — reconcile to that same DB row rather than
    // inserting a second, now-stale record pointing at the same path.
    const existingRow =
      priorStandardRow ??
      (standard
        ? null
        : await prisma.customerDocument.findFirst({
            where: { customerId, storageProvider: "DROPBOX", storageKey: saved.storageKey },
            select: { id: true },
          }))

    const documentData = {
      projectId: resolvedProjectId,
      documentType: resolvedDocumentType,
      originalFileName: file.name,
      storageKey: saved.storageKey,
      mimeType: file.type,
      fileSize: saved.fileSize,
      uploadedById: session.user.id as string,
    }

    const document = existingRow
      ? await prisma.customerDocument.update({
          where: { id: existingRow.id },
          data: documentData,
          include: { uploadedBy: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
        })
      : await prisma.customerDocument.create({
          data: {
            companyId,
            customerId,
            storageProvider: "DROPBOX",
            ...documentData,
          },
          include: { uploadedBy: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
        })

    await logActivity({
      companyId,
      entityType: "CustomerDocument",
      entityId: document.id,
      action: existingRow ? "REPLACED" : "UPLOADED",
      performedById: session.user.id as string,
      metadata: { customerId, fileName: file.name, dropboxFileName },
    })

    revalidatePath(`/customers/${customerId}`)
    return NextResponse.json({ document: { ...document, url: `/api/customers/${customerId}/documents/${document.id}` } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to save document record" }, { status: 500 })
  }
}
