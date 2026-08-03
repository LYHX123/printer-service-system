"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Pencil, CheckCircle, XCircle, Download, FileSpreadsheet, Receipt, ArrowRight, CloudUpload, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { QuotationStatusModal } from "./QuotationStatusModal"
import { GenerateInvoiceModal } from "./GenerateInvoiceModal"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { resyncQuotationDropbox } from "@/lib/actions/quotations"
import type { QuotationStatus, Role } from "@/types"

type ModalTargetStatus = "APPROVED" | "REJECTED" | "EXPIRED"

interface QuotationActionsProps {
  quotationId: string
  status: QuotationStatus
  role: Role
  /** Null when this quotation has no invoice yet — shows "Create Invoice" instead of "View Invoice". At most one invoice per quotation (enforced by a DB unique constraint). */
  existingInvoice: { id: string; invoiceNumber: string } | null
  canConvertToInvoice: boolean
  customerPin: string
  defaultVatPercent: number
  /** True when the version/FINAL currently being viewed is missing its Dropbox XLSX and/or PDF — shows the "Sync to Dropbox" retry button. Always false while viewing a historical version (see viewMode). */
  needsDropboxSync: boolean
  canSyncDropbox: boolean
  /** "current" | "historical" | "final" — which version of the quotation the Detail page is currently showing. Business actions (Adjust/Approve/Sync) only ever apply to "current" or "final"; Reject/Adjust are current-only. */
  viewMode: "current" | "historical" | "final"
  /** Explicit version to (re)sync — undefined lets resyncQuotationDropbox fall back to its own current-vs-FINAL default (used for viewMode "final"). */
  syncTargetVersion?: number
  /** Version-aware download links — null hides/disables that Download button (no synced file for the version being viewed). Never a generic "always latest" link once a specific version is being viewed. */
  pdfDownloadUrl: string | null
  excelDownloadUrl: string | null
}

export function QuotationActions({
  quotationId,
  status,
  existingInvoice,
  canConvertToInvoice,
  customerPin,
  defaultVatPercent,
  needsDropboxSync,
  canSyncDropbox,
  viewMode,
  syncTargetVersion,
  pdfDownloadUrl,
  excelDownloadUrl,
}: QuotationActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [statusModal, setStatusModal] = useState<ModalTargetStatus | null>(null)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [isSyncing, startSyncing] = useTransition()

  const isCurrent = viewMode === "current"

  // "Adjust Quotation" reuses the existing edit page/action — updateQuotation
  // now always archives a new Dropbox version on save (see
  // Quotation.currentVersion), so this one path is the only way to change a
  // quotation's business data; there's no separate plain "Edit" left to
  // silently bypass version tracking. Approve is a standalone action, not
  // gated on having gone through "Send to Customer" first (removed — see
  // QUOTATION_STATUS_TRANSITIONS). Both are current-view-only: a historical
  // version being read-only is the whole point of Historical View.
  const canAdjust = isCurrent && (status === "DRAFT" || status === "SENT")
  const canApprove = isCurrent && (status === "DRAFT" || status === "SENT")
  const canReject = isCurrent && status === "SENT"

  function handleSync() {
    startSyncing(async () => {
      const result = await resyncQuotationDropbox(quotationId, syncTargetVersion)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("dropboxSyncSuccess"))
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {pdfDownloadUrl ? (
          <a href={pdfDownloadUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
              {t("downloadPdf")}
            </Button>
          </a>
        ) : (
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} disabled>
            {t("downloadPdf")}
          </Button>
        )}
        {excelDownloadUrl ? (
          <a href={excelDownloadUrl}>
            <Button variant="outline" size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
              {t("downloadExcel")}
            </Button>
          </a>
        ) : (
          <Button variant="outline" size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />} disabled>
            {t("downloadExcel")}
          </Button>
        )}
        {viewMode !== "historical" && canSyncDropbox && needsDropboxSync && (
          <Button
            variant="outline"
            size="sm"
            icon={<CloudUpload className="h-3.5 w-3.5" />}
            loading={isSyncing}
            onClick={handleSync}
          >
            {t("syncToDropbox")}
          </Button>
        )}
        {canAdjust && (
          <Link href={`/quotations/${quotationId}/edit`}>
            <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
              {t("adjustQuotation")}
            </Button>
          </Link>
        )}

        {canApprove && (
          <Button
            size="sm"
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            onClick={() => setStatusModal("APPROVED")}
          >
            Approve
          </Button>
        )}
        {canReject && (
          <Button
            size="sm"
            variant="outline"
            icon={<XCircle className="h-3.5 w-3.5" />}
            onClick={() => setStatusModal("REJECTED")}
          >
            Reject
          </Button>
        )}

        {viewMode === "historical" && (
          <Link href={`/quotations/${quotationId}`}>
            <Button variant="outline" size="sm" icon={<History className="h-3.5 w-3.5" />}>
              {t("backToCurrentVersion")}
            </Button>
          </Link>
        )}

        {/* Generate/View Invoice — only in Current or FINAL, never while viewing a historical version (see viewMode). */}
        {viewMode !== "historical" &&
          (existingInvoice ? (
            <Link href={`/quotations/invoices/${existingInvoice.id}`}>
              <Button size="sm" variant="outline" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                {t("viewInvoice")}
              </Button>
            </Link>
          ) : (
            // Gated to Approved quotations only — a quotation can still change
            // (Adjust produces a new version) up until it's Approved, so an
            // invoice generated any earlier could end up quoting content that
            // was later revised. This is a presentation-only gate; the
            // generateInvoice action/Invoice module itself is unchanged.
            canConvertToInvoice &&
            status === "APPROVED" && (
              <Button
                size="sm"
                icon={<Receipt className="h-3.5 w-3.5" />}
                onClick={() => setInvoiceModalOpen(true)}
              >
                {t("generateInvoice")}
              </Button>
            )
          ))}
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
