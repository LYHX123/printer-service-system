"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Plus, Download, Trash2, FileText, Upload, RefreshCw } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { FormField } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE, CUSTOMER_DOCUMENT_TYPES, CUSTOMER_STANDARD_DOCUMENT_TYPES } from "@/lib/constants"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { CustomerDocumentListItem } from "@/lib/data/customerDocuments"
import type { CustomerBranchDetail } from "@/lib/data/customerBranches"

interface CustomerDocumentsProps {
  customerId: string
  documents: CustomerDocumentListItem[]
  projects: CustomerBranchDetail[]
  canManage: boolean
  /** Documents upload to Dropbox under this customer's Short Name — null/empty blocks uploads until it's set. */
  customerShortName: string | null
}

const DOCUMENT_TYPE_KEYS: Record<(typeof CUSTOMER_DOCUMENT_TYPES)[number], TranslationKey> = {
  CONTRACT: "documentTypeContract",
  ID_DOCUMENT: "documentTypeIdDocument",
  CORRESPONDENCE: "documentTypeCorrespondence",
  OTHER: "documentTypeOther",
  REGISTRATION_CERTIFICATE: "registrationCertificate",
  PIN_CERTIFICATE: "pinCertificate",
  CR12: "cr12",
  VAT_CERTIFICATE: "vatCertificate",
  COMPANY_PROFILE: "companyProfile",
}

// Generic "Other documents" upload only offers the original free-form types — the 5
// standard types each get their own dedicated slot above (see StandardDocumentSlot) so
// there's exactly one upload path per standard type, not two competing ones.
const GENERIC_DOCUMENT_TYPES = CUSTOMER_DOCUMENT_TYPES.filter(
  (type) => !(CUSTOMER_STANDARD_DOCUMENT_TYPES as readonly string[]).includes(type)
)

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function uploadCustomerDocument(customerId: string, file: File, documentType: string, projectId?: string) {
  const formData = new FormData()
  formData.set("file", file)
  formData.set("documentType", documentType)
  if (projectId) formData.set("projectId", projectId)
  const res = await fetch(`/api/customers/${customerId}/documents`, { method: "POST", body: formData })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Failed to upload document")
  return body.document as { id: string }
}

async function deleteCustomerDocument(customerId: string, documentId: string) {
  const res = await fetch(`/api/customers/${customerId}/documents/${documentId}`, { method: "DELETE" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? "Failed to delete document")
  }
}

// ─── One fixed, named row per standard document type (Registration Certificate / PIN
// Certificate / CR12 / VAT Certificate / Company Profile) — self-contained upload/replace/
// delete. Each slot is independently optional, keeps at most one *current* Dropbox file
// (saved under a standardized name — see dropboxFileNameFor), and records who/when uploaded.

interface StandardDocumentSlotProps {
  customerId: string
  type: (typeof CUSTOMER_STANDARD_DOCUMENT_TYPES)[number]
  doc: CustomerDocumentListItem | undefined
  canUpload: boolean
  canDelete: boolean
  onChanged: () => void
}

function StandardDocumentSlot({ customerId, type, doc, canUpload, canDelete, onChanged }: StandardDocumentSlotProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function pickFile() {
    fileInputRef.current?.click()
  }

  async function handleFileChosen(replacingId: string | null) {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      toast.error(t("documentTypeNotAllowed"))
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      toast.error(t("documentTooLarge"))
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setBusy(true)
    try {
      await uploadCustomerDocument(customerId, file, type)
      // Replace = upload the new one first, then drop the old one — never leaves the
      // customer with zero copies of the document if the upload itself fails.
      if (replacingId) {
        await deleteCustomerDocument(customerId, replacingId).catch(() => {
          toast.error(t("replaceDocumentPartial"))
        })
      }
      toast.success(t("documentUploaded"))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("documentUploadFailed"))
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDelete() {
    if (!doc) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setBusy(true)
    try {
      await deleteCustomerDocument(customerId, doc.id)
      toast.success(t("documentDeleted"))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("documentDeleteFailed"))
    } finally {
      setBusy(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ALLOWED_DOCUMENT_TYPES.join(",")}
        onChange={() => handleFileChosen(doc ? doc.id : null)}
      />
      <div className="flex min-w-0 items-center gap-3">
        <FileText className={`h-8 w-8 shrink-0 ${doc ? "text-slate-300" : "text-slate-200"}`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {doc?.dropboxFileName ?? t(DOCUMENT_TYPE_KEYS[type])}
          </p>
          {doc ? (
            <>
              <p className="truncate text-xs text-slate-500">
                {doc.dropboxFileName && doc.dropboxFileName !== doc.originalFileName && (
                  <>
                    {t("originalLabel")}: {doc.originalFileName}
                    {" · "}
                  </>
                )}
                {format(new Date(doc.createdAt), "dd MMM yyyy")}
                {" · "}
                {doc.uploadedBy.name}
                {" · "}
                {formatFileSize(doc.fileSize)}
              </p>
              {doc.dropboxPath && <p className="truncate font-mono text-[11px] text-slate-400">{doc.dropboxPath}</p>}
            </>
          ) : (
            <p className="text-xs italic text-slate-400">{t("documentNotUploaded")}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {doc && (
          <a href={doc.url} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
              {t("download")}
            </Button>
          </a>
        )}
        {canUpload && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={doc ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            loading={busy && !confirmingDelete}
            onClick={pickFile}
          >
            {doc ? t("replace") : t("uploadFile")}
          </Button>
        )}
        {canDelete && doc && (
          confirmingDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">{t("confirmDeleteDocument")}</span>
              <button type="button" className="font-medium text-red-600 underline" onClick={handleDelete}>
                {t("delete")}
              </button>
              <button type="button" className="text-slate-500" onClick={() => setConfirmingDelete(false)}>
                {t("cancel")}
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              loading={busy && confirmingDelete}
              onClick={handleDelete}
            >
              {t("delete")}
            </Button>
          )
        )}
      </div>
    </div>
  )
}

export function CustomerDocuments({ customerId, documents, projects, canManage, customerShortName }: CustomerDocumentsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // Uploads go to Dropbox under this customer's Short Name — without one there's
  // nowhere to put the file, so uploading (not viewing/deleting existing docs) is
  // gated on it in addition to the usual permission check.
  const canUpload = canManage && Boolean(customerShortName?.trim())
  const [documentType, setDocumentType] = useState<string>("OTHER")
  const [projectId, setProjectId] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  function refresh() {
    router.refresh()
  }

  // documents is already ordered createdAt desc, so the first match per type is the latest.
  const standardDocs = CUSTOMER_STANDARD_DOCUMENT_TYPES.map((type) => ({
    type,
    doc: documents.find((d) => d.documentType === type),
  }))
  const genericDocs = documents.filter(
    (d) => !(CUSTOMER_STANDARD_DOCUMENT_TYPES as readonly string[]).includes(d.documentType ?? "")
  )

  function openModal() {
    setDocumentType("OTHER")
    setProjectId("")
    setModalOpen(true)
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error(t("pleaseChooseFile"))
      return
    }
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      toast.error(t("documentTypeNotAllowed"))
      return
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      toast.error(t("documentTooLarge"))
      return
    }

    setUploading(true)
    try {
      await uploadCustomerDocument(customerId, file, documentType, projectId || undefined)
      toast.success(t("documentUploaded"))
      setModalOpen(false)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("documentUploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id)
      return
    }
    setDeletingId(id)
    try {
      await deleteCustomerDocument(customerId, id)
      toast.success(t("documentDeleted"))
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("documentDeleteFailed"))
    } finally {
      setDeletingId(null)
      setConfirmingDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{t("customerDocuments")}</h2>
        {canUpload && (
          <Button type="button" variant="outline" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openModal}>
            {t("uploadFile")}
          </Button>
        )}
      </div>

      {canManage && !customerShortName?.trim() && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("customerShortNameRequiredForUpload")}
        </p>
      )}

      <div className="space-y-2">
        {standardDocs.map(({ type, doc }) => (
          <StandardDocumentSlot
            key={type}
            customerId={customerId}
            type={type}
            doc={doc}
            canUpload={canUpload}
            canDelete={canManage}
            onChanged={refresh}
          />
        ))}
      </div>

      {genericDocs.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("otherDocuments")}</h3>
          {genericDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-8 w-8 shrink-0 text-slate-300" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{doc.dropboxFileName ?? doc.originalFileName}</p>
                  <p className="text-xs text-slate-500">
                    {doc.dropboxFileName && doc.dropboxFileName !== doc.originalFileName && (
                      <>
                        {t("originalLabel")}: {doc.originalFileName}
                        {" · "}
                      </>
                    )}
                    {doc.documentType ? t(DOCUMENT_TYPE_KEYS[doc.documentType as (typeof CUSTOMER_DOCUMENT_TYPES)[number]] ?? "documentTypeOther") : t("generalDocument")}
                    {doc.project ? ` · ${doc.project.name}` : ` · ${t("generalDocument")}`}
                    {" · "}
                    {format(new Date(doc.createdAt), "dd MMM yyyy")}
                    {" · "}
                    {doc.uploadedBy.name}
                    {" · "}
                    {formatFileSize(doc.fileSize)}
                  </p>
                  {doc.dropboxPath && <p className="truncate font-mono text-[11px] text-slate-400">{doc.dropboxPath}</p>}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
                    {t("download")}
                  </Button>
                </a>
                {canManage && (
                  confirmingDeleteId === doc.id ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">{t("confirmDeleteDocument")}</span>
                      <button
                        type="button"
                        className="font-medium text-red-600 underline"
                        onClick={() => handleDelete(doc.id)}
                      >
                        {t("delete")}
                      </button>
                      <button type="button" className="text-slate-500" onClick={() => setConfirmingDeleteId(null)}>
                        {t("cancel")}
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      loading={deletingId === doc.id}
                      onClick={() => handleDelete(doc.id)}
                    >
                      {t("delete")}
                    </Button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("uploadFile")}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" loading={uploading} onClick={handleUpload}>
              {t("uploadFile")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="File" htmlFor="documentFile">
            <input
              ref={fileInputRef}
              id="documentFile"
              type="file"
              accept={ALLOWED_DOCUMENT_TYPES.join(",")}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </FormField>
          <FormField label={t("documentType")} htmlFor="documentType" required>
            <Select id="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {GENERIC_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(DOCUMENT_TYPE_KEYS[type])}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("relatedProject")} htmlFor="documentProject">
            <Select
              id="documentProject"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">{t("generalDocument")}</option>
              {projects
                .filter((p) => p.isActive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
