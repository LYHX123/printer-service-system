"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { QuotationStatusSchema, type QuotationStatusInput } from "@/lib/schemas"
import { updateQuotationStatus } from "@/lib/actions/quotations"
import { Modal } from "@/components/ui/modal"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { QUOTATION_STATUS_LABELS } from "@/types"

type ModalTargetStatus = "SENT" | "APPROVED" | "REJECTED" | "EXPIRED"

interface QuotationStatusModalProps {
  quotationId: string
  targetStatus: ModalTargetStatus
  isOpen: boolean
  onClose: () => void
}

const ACTION_LABEL: Record<ModalTargetStatus, string> = {
  SENT: "Send to Customer",
  APPROVED: "Approve Quotation",
  REJECTED: "Reject Quotation",
  EXPIRED: "Mark Expired",
}

export function QuotationStatusModal({
  quotationId,
  targetStatus,
  isOpen,
  onClose,
}: QuotationStatusModalProps) {
  const router = useRouter()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<QuotationStatusInput>({
    resolver: zodResolver(QuotationStatusSchema) as Resolver<QuotationStatusInput>,
    defaultValues: { toStatus: targetStatus, note: "" },
  })

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(_data: QuotationStatusInput) {
    const result = await updateQuotationStatus(quotationId, { toStatus: targetStatus, note: _data.note })
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Quotation marked as ${QUOTATION_STATUS_LABELS[targetStatus]}`)
    handleClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={ACTION_LABEL[targetStatus]}
      description={`Change quotation status to "${QUOTATION_STATUS_LABELS[targetStatus]}".`}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="quotation-status-form"
            loading={isSubmitting}
            variant={targetStatus === "REJECTED" ? "outline" : undefined}
          >
            {ACTION_LABEL[targetStatus]}
          </Button>
        </div>
      }
    >
      <form id="quotation-status-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Textarea
          rows={3}
          placeholder="Optional note (e.g. reason for rejection, additional context)…"
          {...register("note")}
        />
      </form>
    </Modal>
  )
}
