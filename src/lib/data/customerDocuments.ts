import { prisma } from "@/lib/prisma"
import { getStorageProvider } from "@/lib/storage"
import { getCustomerFolderDisplayPath } from "@/lib/dropbox"

export interface CustomerDocumentListItem {
  id: string
  documentType: string | null
  originalFileName: string
  mimeType: string
  fileSize: number
  createdAt: Date
  url: string
  /** The actual saved Dropbox filename (basename of storageKey) — null for LOCAL-provider (pre-Dropbox) documents. */
  dropboxFileName: string | null
  /** Relative display path, e.g. "Customer/CRBC/PIN Certificate.pdf" — null for LOCAL-provider documents. */
  dropboxPath: string | null
  project: { id: string; name: string } | null
  uploadedBy: { id: string; name: string }
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx >= 0 ? path.slice(idx + 1) : path
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
      customer: { select: { shortName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return rows.map(({ customer, ...r }) => {
    const isDropbox = r.storageProvider === "DROPBOX"
    const dropboxFileName = isDropbox ? basename(r.storageKey) : null
    // customer.shortName is guaranteed non-empty for any DROPBOX row (upload requires it —
    // see the documents API route), but this stays defensive in case of stale data.
    const dropboxPath =
      isDropbox && customer.shortName?.trim() ? `${getCustomerFolderDisplayPath(customer.shortName)}/${dropboxFileName}` : null

    return {
      ...r,
      dropboxFileName,
      dropboxPath,
      // DROPBOX documents are viewed/downloaded via the documents API's GET
      // handler (mints a fresh temporary link per request) rather than a
      // static URL — see src/app/api/customers/[id]/documents/[documentId]/route.ts.
      url: isDropbox ? `/api/customers/${customerId}/documents/${r.id}` : getStorageProvider(r.storageProvider).getUrl(r.storageKey),
    }
  })
}
