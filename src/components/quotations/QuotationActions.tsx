"use client"

import { useState } from "react"
import Link from "next/link"
import { Pencil, Send, CheckCircle, XCircle, Download, FileSpreadsheet, Receipt, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuotationStatusModal } from "./QuotationStatusModal"
import { GenerateInvoiceModal } from "./GenerateInvoiceModal"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { QuotationStatus, Role } from "@/types"

type ModalTargetStatus = "SENT" | "APPROVED" | "REJECTED" | "EXPIRED"

interface QuotationActionsProps {
  quotationId: string
  status: QuotationStatus
  role: Role
  /** Null when this quotation has no invoice yet — shows "Create Invoice" instead of "View Invoice". At most one invoice per quotation (enforced by a DB unique constraint). */
  existingInvoice: { id: string; invoiceNumber: string } | null
  canConvertToInvoice: boolean
  customerPin: string
  defaultVatPercent: number
}

export function QuotationActions({
  quotationId,
  status,
  existingInvoice,
  canConvertToInvoice,
  customerPin,
  defaultVatPercent,
}: QuotationActionsProps) {
  const { t } = useLanguage()
  const [statusModal, setStatusModal] = useState<ModalTargetStatus | null>(null)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)

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
        <a href={`/api/quotations/${quotationId}/excel`}>
          <Button variant="outline" size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
            {t("downloadExcel")}
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

        {existingInvoice ? (
          <Link href={`/quotations/invoices/${existingInvoice.id}`}>
            <Button size="sm" variant="outline" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              {t("viewInvoice")}
            </Button>
          </Link>
        ) : (
          canConvertToInvoice && (
            <Button
              size="sm"
              icon={<Receipt className="h-3.5 w-3.5" />}
              onClick={() => setInvoiceModalOpen(true)}
            >
              {t("generateInvoice")}
            </Button>
          )
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

      {!existingInvoice && (
        <GenerateInvoiceModal
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          quotationId={quotationId}
          customerPin={customerPin}
          defaultVatPercent={defaultVatPercent}
        />
      )}
    </>
  )
}
