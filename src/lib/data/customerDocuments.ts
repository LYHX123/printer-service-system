import { prisma } from "@/lib/prisma"
import { getStorageProvider } from "@/lib/storage"

export interface CustomerDocumentListItem {
  id: string
  documentType: string | null
  originalFileName: string
  mimeType: string
  fileSize: number
  createdAt: Date
  url: string
  project: { id: string; name: string } | null
  uploadedBy: { id: string; name: string }
}

export async function getCustomerDocuments(
  customerId: string,
  companyId: string
): Promise<CustomerDocumentListItem[]> {
  const rows = await prisma.customerDocument.findMany({
    where: { customerId, customer: { companyId } },
    select: {
      id: true,
      documentType: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      storageKey: true,
      storageProvider: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return rows.map((r) => ({
    ...r,
    url: getStorageProvider(r.storageProvider).getUrl(r.storageKey),
  }))
}
