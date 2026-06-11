"use client"

import { useState } from "react"
import Link from "next/link"
import { Pencil, Send, CheckCircle, XCircle, Briefcase, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { QuotationStatusModal } from "./QuotationStatusModal"
import { convertToJob } from "@/lib/actions/quotations"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { QuotationStatus, Role } from "@/types"

type ModalTargetStatus = "SENT" | "APPROVED" | "REJECTED" | "EXPIRED"

interface QuotationActionsProps {
  quotationId: string
  status: QuotationStatus
  role: Role
}

export function QuotationActions({ quotationId, status, role }: QuotationActionsProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const [statusModal, setStatusModal] = useState<ModalTargetStatus | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)
  const [converting, setConverting] = useState(false)

  const canEdit = status === "DRAFT" || status === "SENT"
  const canManage = role === "ADMIN" || role === "MANAGER"

  async function handleConvert() {
    setConverting(true)
    const result = await convertToJob(quotationId)
    if (result?.error) {
      toast.error(result.error)
      setConverting(false)
      setConvertOpen(false)
    }
    // on success: redirect happens server-side
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/quotations/${quotationId}/pdf`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
            {t("downloadPdf")}
          </Button>
        </a>
        {canEdit && (
          <Link href={`/quotations/${quotationId}/edit`}>
            <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
              {t("edit")}
            </Button>
          </Link>
        )}

        {status === "DRAFT" && canManage && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Send className="h-3.5 w-3.5" />}
            onClick={() => setStatusModal("SENT")}
          >
            Send to Customer
          </Button>
        )}

        {status === "SENT" && canManage && (
          <>
            <Button
              size="sm"
              icon={<CheckCircle className="h-3.5 w-3.5" />}
              onClick={() => setStatusModal("APPROVED")}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<XCircle className="h-3.5 w-3.5" />}
              onClick={() => setStatusModal("REJECTED")}
            >
              Reject
            </Button>
          </>
        )}

        {status === "APPROVED" && canManage && (
          <Button
            size="sm"
            icon={<Briefcase className="h-3.5 w-3.5" />}
            onClick={() => setConvertOpen(true)}
          >
            Convert to Job
          </Button>
        )}
      </div>

      {statusModal && (
        <QuotationStatusModal
          quotationId={quotationId}
          targetStatus={statusModal}
          isOpen={true}
          onClose={() => setStatusModal(null)}
        />
      )}

      <Modal
        isOpen={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Convert to Service Job"
        description="This will create a new service job from this quotation and mark it as converted. You can reassign the engineer on the job page."
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConvertOpen(false)}
              disabled={converting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              loading={converting}
              onClick={handleConvert}
              icon={!converting ? <Briefcase className="h-3.5 w-3.5" /> : undefined}
            >
              Convert to Job
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          A new job will be created with the same customer, equipment, and service type. The job will be assigned to you initially.
        </p>
      </Modal>
    </>
  )
}
