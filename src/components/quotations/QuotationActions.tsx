"use client"

import { useState } from "react"
import Link from "next/link"
import { Pencil, Send, CheckCircle, XCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuotationStatusModal } from "./QuotationStatusModal"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { QuotationStatus, Role } from "@/types"

type ModalTargetStatus = "SENT" | "APPROVED" | "REJECTED" | "EXPIRED"

interface QuotationActionsProps {
  quotationId: string
  status: QuotationStatus
  role: Role
}

export function QuotationActions({ quotationId, status, role }: QuotationActionsProps) {
  const { t } = useLanguage()
  const [statusModal, setStatusModal] = useState<ModalTargetStatus | null>(null)

  const canEdit = status === "DRAFT" || status === "SENT"
  // Opened to all roles.
  const canManage = true

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
      </div>

      {statusModal && (
        <QuotationStatusModal
          quotationId={quotationId}
          targetStatus={statusModal}
          isOpen={true}
          onClose={() => setStatusModal(null)}
        />
      )}
    </>
  )
}
