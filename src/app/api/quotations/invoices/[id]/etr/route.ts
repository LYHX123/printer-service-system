import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess, canEditInvoice } from "@/lib/permissions"
import { ALLOWED_ETR_TYPES, MAX_DOCUMENT_SIZE } from "@/lib/constants"
import { logActivity, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import {
  getDropboxConnectionStatus,
  ensureInvoiceMonthFolders,
  buildInvoiceEtrFileName,
  uploadInvoiceDocumentToDropbox,
  deleteInvoiceDocumentFromDropbox,
  DropboxError,
} from "@/lib/dropbox"
import type { Role } from "@/types"

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".")
  return idx >= 0 ? fileName.slice(idx + 1) : ""
}

function folderPathOf(storageKey: string): string {
  const idx = storageKey.lastIndexOf("/")
  return idx >= 0 ? storageKey.slice(0, idx) : storageKey
}

async function checkPermission() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const
  }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "invoice", permissions) || !canEditInvoice(role, permissions)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const
  }
  return { session, companyId: session.user.companyId as string } as const
}

/**
 * Upload or replace this Invoice's ETR/eTIMS tax receipt. Unlike PDF/XLSX
 * (system-generated, re-synced in place at a deterministic path), ETR is a
 * pure user upload with no versioning — at most one current row per invoice
 * (InvoiceDocument's existing @@unique([invoiceId, fileType]) already
 * enforces this).
 *
 * First-time upload targets the Invoice's *current* Date's Month ETR
 * folder. Replacing an existing ETR reuses whatever folder its storageKey
 * already points to — editing the Invoice Date later never moves an
 * already-uploaded ETR to a different month.
 *
 * If the replacement has a different extension than the one on file, the
 * new file is uploaded (and the DB record updated) *before* the old file is
 * best-effort deleted — never the other way around, so a mid-operation
 * failure never leaves the invoice with zero ETR files.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth_ = await checkPermission()
  if ("error" in auth_) return auth_.error
  const { session, companyId } = auth_
  const userId = session.user.id as string
  const { id: invoiceId } = await params

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, invoiceNumber: true, date: true },
  })
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_ETR_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF, JPG, and PNG files are allowed" }, { status: 400 })
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 })
  }

  const dropboxStatus = await getDropboxConnectionStatus(companyId)
  if (!dropboxStatus.configured || !dropboxStatus.connected) {
    return NextResponse.json(
      { error: "Dropbox is not connected. Connect it in Settings before uploading the ETR." },
      { status: 400 }
    )
  }

  const existing = await prisma.invoiceDocument.findFirst({
    where: { invoiceId, companyId, fileType: "ETR" },
    select: { id: true, storageKey: true },
  })

  let folderPath: string
  try {
    if (existing) {
      folderPath = folderPathOf(existing.storageKey)
    } else {
      const year = invoice.date.getFullYear()
      const month = invoice.date.getMonth() + 1
      const folders = await ensureInvoiceMonthFolders(companyId, year, month)
      folderPath = folders.monthEtrPath
    }
  } catch (error) {
    console.error(`[invoice ${invoiceId}] ETR folder preparation failed:`, error)
    return NextResponse.json(
      { error: error instanceof DropboxError ? error.message : "Failed to prepare the ETR Dropbox folder" },
      { status: 502 }
    )
  }

  const extension = extensionOf(file.name)
  const fileName = buildInvoiceEtrFileName(invoice.invoiceNumber, extension)

  const buffer = Buffer.from(await file.arrayBuffer())

  let path: string
  try {
    ;({ path } = await uploadInvoiceDocumentToDropbox(companyId, folderPath, fileName, buffer))
  } catch (error) {
    console.error(`[invoice ${invoiceId}] ETR Dropbox upload failed:`, error)
    return NextResponse.json(
      { error: error instanceof DropboxError ? error.message : "Failed to upload the ETR to Dropbox" },
      { status: 502 }
    )
  }

  let document
  try {
    document = await prisma.invoiceDocument.upsert({
      where: { invoiceId_fileType: { invoiceId, fileType: "ETR" } },
      create: {
        companyId,
        invoiceId,
        fileType: "ETR",
        originalFileName: file.name,
        storageKey: path,
        storageProvider: "DROPBOX",
        mimeType: file.type,
        fileSize: buffer.length,
      },
      update: {
        originalFileName: file.name,
        storageKey: path,
        storageProvider: "DROPBOX",
        mimeType: file.type,
        fileSize: buffer.length,
      },
    })
  } catch (error) {
    // The file is already sitting in Dropbox at `path` — only the DB record
    // failed to save. Left as-is: the next upload attempt overwrites the
    // same file and will succeed in saving the record once the DB issue clears.
    console.error(`[invoice ${invoiceId}] ETR InvoiceDocument DB save failed (file uploaded to Dropbox at ${path}):`, error)
    return NextResponse.json({ error: "ETR uploaded but the database record failed to save" }, { status: 500 })
  }

  if (existing && existing.storageKey !== path) {
    // Extension changed — the previous file is now an orphaned copy at a
    // different path. Best-effort cleanup only: the new file is already
    // uploaded and the DB record already points at it regardless of whether
    // this succeeds.
    try {
      await deleteInvoiceDocumentFromDropbox(companyId, existing.storageKey)
    } catch (error) {
      console.error(`[invoice ${invoiceId}] Failed to remove superseded ETR file:`, existing.storageKey, error)
    }
  }

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.INVOICE_DOCUMENT,
    entityId: document.id,
    action: existing ? AUDIT_ACTIONS.REPLACED : AUDIT_ACTIONS.UPLOADED,
    performedById: userId,
    metadata: { invoiceId, invoiceNumber: invoice.invoiceNumber, fileName: file.name },
  })

  revalidatePath(`/quotations/invoices/${invoiceId}`)
  return NextResponse.json({ document })
}

/**
 * Deletes this Invoice's ETR — the Dropbox file and the InvoiceDocument
 * row. Never touches the Invoice's PDF/XLSX or their Month Invoice/Month
 * ETR folders. A Dropbox delete failure that's just "already gone"
 * (not_found) is treated as success; any other Dropbox error still blocks
 * the DB row from being deleted, so the two never drift apart.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth_ = await checkPermission()
  if ("error" in auth_) return auth_.error
  const { session, companyId } = auth_
  const userId = session.user.id as string
  const { id: invoiceId } = await params

  const document = await prisma.invoiceDocument.findFirst({
    where: { invoiceId, companyId, fileType: "ETR" },
  })
  if (!document) {
    return NextResponse.json({ error: "ETR not found" }, { status: 404 })
  }

  if (document.storageProvider === "DROPBOX") {
    try {
      await deleteInvoiceDocumentFromDropbox(companyId, document.storageKey)
    } catch (error) {
      console.error(`[invoice ${invoiceId}] ETR Dropbox delete failed:`, error)
      return NextResponse.json(
        { error: error instanceof DropboxError ? error.message : "Failed to delete the ETR from Dropbox" },
        { status: 502 }
      )
    }
  }

  await prisma.invoiceDocument.delete({ where: { id: document.id } })

  await logActivity({
    companyId,
    entityType: AUDIT_ENTITY_TYPES.INVOICE_DOCUMENT,
    entityId: document.id,
    action: AUDIT_ACTIONS.REMOVED,
    performedById: userId,
    metadata: { invoiceId, fileName: document.originalFileName },
  })

  revalidatePath(`/quotations/invoices/${invoiceId}`)
  return NextResponse.json({ success: true })
}
