import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess } from "@/lib/permissions"
import { getStorageProvider } from "@/lib/storage"
import { logActivity } from "@/lib/audit"
import type { Role } from "@/types"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
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
  const { id: customerId, documentId } = await params

  const document = await prisma.customerDocument.findFirst({
    where: { id: documentId, customerId, customer: { companyId } },
  })
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const provider = getStorageProvider(document.storageProvider)
  await provider.delete(document.storageKey)
  await prisma.customerDocument.delete({ where: { id: documentId } })

  await logActivity({
    companyId,
    entityType: "CustomerDocument",
    entityId: documentId,
    action: "DELETED",
    performedById: session.user.id as string,
    metadata: { customerId, fileName: document.originalFileName },
  })

  revalidatePath(`/customers/${customerId}`)
  return NextResponse.json({ success: true })
}
