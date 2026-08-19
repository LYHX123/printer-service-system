"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { ConvertQuotationToDeliverySchema, type ConvertQuotationToDeliveryInput } from "@/lib/schemas"
import { createDeliveryFromQuotation } from "@/lib/actions/deliveries"
import type { StockShortfall } from "@/lib/actions/deliveries"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { todayLocalDate } from "@/lib/utils"

interface ConvertToDeliveryModalProps {
  isOpen: boolean
  onClose: () => void
  quotationId: string
}

export function ConvertToDeliveryModal({ isOpen, onClose, quotationId }: ConvertToDeliveryModalProps) {
  const toast = useToast()

  const defaultValues: ConvertQuotationToDeliveryInput = {
    deliveryDate: todayLocalDate(),
    reference: "",
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConvertQuotationToDeliveryInput>({
    resolver: zodResolver(ConvertQuotationToDeliverySchema) as Resolver<ConvertQuotationToDeliveryInput>,
    defaultValues,
  })

  function handleClose() {
    reset(defaultValues)
    onClose()
  }

  async function onSubmit(data: ConvertQuotationToDeliveryInput) {
    const result = await createDeliveryFromQuotation(quotationId, data)
    if (result?.error) {
      if (result.shortfalls?.length) {
        const detail = (result.shortfalls as StockShortfall[])
          .map((s) => `${s.name}: have ${s.have}, need ${s.need}`)
          .join("; ")
        toast.error(`${result.error} — ${detail}`)
      } else {
        toast.error(result.error)
      }
      return
    }
    // Success path redirects server-side to the new delivery.
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Convert to Delivery"
      description="Creates a new Delivery from this quotation's items and quantities, and deducts stock immediately. The quotation itself is not changed."
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="convert-to-delivery-form" loading={isSubmitting}>
            Convert to Delivery
          </Button>
        </div>
      }
    >
      <form id="convert-to-delivery-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Delivery Date" htmlFor="deliveryDate" required error={errors.deliveryDate?.message}>
          <Input id="deliveryDate" type="date" {...register("deliveryDate")} />
        </FormField>
        <FormField label="Reference (optional)" htmlFor="reference" error={errors.reference?.message}>
          <Input id="reference" placeholder="e.g. customer PO number" {...register("reference")} />
        </FormField>
      </form>
    </Modal>
  )
}
