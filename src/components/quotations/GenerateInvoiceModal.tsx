"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { GenerateInvoiceSchema, type GenerateInvoiceInput } from "@/lib/schemas"
import { generateInvoice } from "@/lib/actions/invoices"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface GenerateInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  quotationId: string
  customerPin: string
  defaultVatPercent: number
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function GenerateInvoiceModal({
  isOpen,
  onClose,
  quotationId,
  customerPin,
  defaultVatPercent,
}: GenerateInvoiceModalProps) {
  const toast = useToast()
  const { t } = useLanguage()

  // No auto-suggested number — invoiceNumber is always manually typed by the user
  // (e.g. "CN00455"), never system-generated.
  const defaultValues: GenerateInvoiceInput = {
    invoiceNumber: "",
    date: todayIso(),
    customerPin,
    vatPercent: defaultVatPercent,
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GenerateInvoiceInput>({
    resolver: zodResolver(GenerateInvoiceSchema) as Resolver<GenerateInvoiceInput>,
    defaultValues,
  })

  function handleClose() {
    reset(defaultValues)
    onClose()
  }

  async function onSubmit(data: GenerateInvoiceInput) {
    const result = await generateInvoice(quotationId, data)
    if (result?.error) {
      toast.error(result.error === "INVOICE_NUMBER_EXISTS" ? t("invoiceNumberExists") : result.error)
      return
    }
    // Success path redirects server-side to the new invoice.
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("generateInvoice")}
      description={t("generateInvoiceDesc")}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="generate-invoice-form" loading={isSubmitting}>
            {t("generateInvoice")}
          </Button>
        </div>
      }
    >
      <form id="generate-invoice-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          label={t("invoiceNumberLabel")}
          htmlFor="invoiceNumber"
          required
          error={errors.invoiceNumber?.message}
        >
          <Input id="invoiceNumber" placeholder="e.g. CN00455" {...register("invoiceNumber")} />
        </FormField>
        <FormField
          label={t("invoiceDateLabel")}
          htmlFor="invoiceDate"
          required
          error={errors.date?.message}
        >
          <Input id="invoiceDate" type="date" {...register("date")} />
        </FormField>
        <FormField
          label={t("invoiceCustomerPinLabel")}
          htmlFor="invoiceCustomerPin"
          error={errors.customerPin?.message}
        >
          <Input id="invoiceCustomerPin" {...register("customerPin")} />
        </FormField>
        <FormField
          label={t("invoiceVatPercentLabel")}
          htmlFor="invoiceVatPercent"
          required
          error={errors.vatPercent?.message}
        >
          <Input id="invoiceVatPercent" type="number" step="0.01" min="0" max="100" {...register("vatPercent")} />
        </FormField>
      </form>
    </Modal>
  )
}
