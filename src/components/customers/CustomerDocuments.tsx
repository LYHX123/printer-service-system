"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Plus, Download, Trash2, FileText } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { FormField } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE, CUSTOMER_DOCUMENT_TYPES } from "@/lib/constants"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { CustomerDocumentListItem } from "@/lib/data/customerDocuments"
import type { CustomerBranchDetail } from "@/lib/data/customerBranches"

interface CustomerDocumentsProps {
  customerId: string
  documents: CustomerDocumentListItem[]
  projects: CustomerBranchDetail[]
  canManage: boolean
}

const DOCUMENT_TYPE_KEYS: Record<(typeof CUSTOMER_DOCUMENT_TYPES)[number], TranslationKey> = {
  CONTRACT: "documentTypeContract",
  ID_DOCUMENT: "documentTypeIdDocument",
  CORRESPONDENCE: "documentTypeCorrespondence",
  OTHER: "documentTypeOther",
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CustomerDocuments({ customerId, documents, projects, canManage }: CustomerDocumentsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [documentType, setDocumentType] = useState<string>("OTHER")
  const [projectId, setProjectId] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  function openModal() {
    setDocumentType("OTHER")
    setProjectId("")
    setModalOpen(true)
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error("Please choose a file")
      return
    }
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      toast.error("Only JPG, PNG, WEBP, PDF, and Word documents are allowed")
      return
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      toast.error("File exceeds 10MB limit")
      return
    }

    const formData = new FormData()
    formData.set("file", file)
    formData.set("documentType", documentType)
    if (projectId) formData.set("projectId", projectId)

    setUploading(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/documents`, { method: "POST", body: formData })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? "Failed to upload document")
        return
      }
      toast.success("Document uploaded")
      setModalOpen(false)
      router.refresh()
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
      const res = await fetch(`/api/customers/${customerId}/documents/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Failed to delete document")
        return
      }
      toast.success("Document deleted")
      router.refresh()
    } finally {
      setDeletingId(null)
      setConfirmingDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{t("documents")}</h2>
        {canManage && (
          <Button type="button" variant="outline" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openModal}>
            {t("uploadFile")}
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-slate-400 italic">{t("noDocumentsYet")}</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-8 w-8 shrink-0 text-slate-300" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{doc.originalFileName}</p>
                  <p className="text-xs text-slate-500">
                    {doc.documentType ? t(DOCUMENT_TYPE_KEYS[doc.documentType as (typeof CUSTOMER_DOCUMENT_TYPES)[number]] ?? "documentTypeOther") : t("generalDocument")}
                    {doc.project ? ` · ${doc.project.name}` : ` · ${t("generalDocument")}`}
                    {" · "}
                    {format(new Date(doc.createdAt), "dd MMM yyyy")}
                    {" · "}
                    {doc.uploadedBy.name}
                    {" · "}
                    {formatFileSize(doc.fileSize)}
                  </p>
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
          <FormField label={t("documentType")} htmlFor="documentType">
            <Select id="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {CUSTOMER_DOCUMENT_TYPES.map((type) => (
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
