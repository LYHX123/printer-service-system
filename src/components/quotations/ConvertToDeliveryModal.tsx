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
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { todayLocalDate } from "@/lib/utils"

interface ConvertToDeliveryModalProps {
  isOpen: boolean
  onClose: () => void
  quotationId: string
}

export function ConvertToDeliveryModal({ isOpen, onClose, quotationId }: ConvertToDeliveryModalProps) {
  const toast = useToast()
  const { t } = useLanguage()

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
      title={t("convertToDeliveryTitle")}
      description={t("convertToDeliveryDesc")}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="convert-to-delivery-form" loading={isSubmitting}>
            {t("convertToDeliveryTitle")}
          </Button>
        </div>
      }
    >
      <form id="convert-to-delivery-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label={t("deliveryDateLabel")} htmlFor="deliveryDate" required error={errors.deliveryDate?.message}>
          <Input id="deliveryDate" type="date" {...register("deliveryDate")} />
        </FormField>
        <FormField label={t("referenceOptionalLabel")} htmlFor="reference" error={errors.reference?.message}>
          <Input id="reference" placeholder={t("referencePlaceholder")} {...register("reference")} />
        </FormField>
      </form>
    </Modal>
  )
}
