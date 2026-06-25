"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { SalesLedgerEntrySchema, type SalesLedgerEntryInput } from "@/lib/schemas"
import { createSalesLedgerEntry, updateSalesLedgerEntry } from "@/lib/actions/ledger"
import { computeSalesLedgerStatus } from "@/lib/ledger-utils"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SalesPaymentStatusBadge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { formatCurrency } from "@/lib/utils"
import type { SalesLedgerListItem } from "@/lib/data/ledger"

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface SalesLedgerModalProps {
  isOpen: boolean
  onClose: () => void
  entry?: SalesLedgerListItem
}

export function SalesLedgerModal({ isOpen, onClose, entry }: SalesLedgerModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const isEditing = Boolean(entry)

  const defaultValues: SalesLedgerEntryInput = entry
    ? {
        date: new Date(entry.date).toISOString().slice(0, 10),
        customerName: entry.customerName,
        orderNo: entry.orderNo ?? "",
        invoiceAmount: entry.invoiceAmount,
        amountReceived: entry.amountReceived,
        remark: entry.remark ?? "",
      }
    : { date: todayIso(), customerName: "", orderNo: "", invoiceAmount: 0, amountReceived: 0, remark: "" }

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SalesLedgerEntryInput>({
    resolver: zodResolver(SalesLedgerEntrySchema) as Resolver<SalesLedgerEntryInput>,
    defaultValues,
  })

  useEffect(() => {
    if (isOpen) reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry])

  const invoiceAmount = Number(watch("invoiceAmount")) || 0
  const amountReceived = Number(watch("amountReceived")) || 0
  const { balance, status } = computeSalesLedgerStatus(invoiceAmount, amountReceived)

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(data: SalesLedgerEntryInput) {
    const result = isEditing ? await updateSalesLedgerEntry(entry!.id, data) : await createSalesLedgerEntry(data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(isEditing ? "Record updated" : "Record saved")
    handleClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? t("editSalesRecord") : t("addSalesRecord")}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="sales-ledger-form" loading={isSubmitting}>
            {t("save")}
          </Button>
        </div>
      }
    >
      <form id="sales-ledger-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label={t("date")} htmlFor="salesDate" required error={errors.date?.message}>
          <Input id="salesDate" type="date" {...register("date")} />
        </FormField>

        <FormField label={t("salesCustomerName")} htmlFor="salesCustomerName" required error={errors.customerName?.message}>
          <Input id="salesCustomerName" {...register("customerName")} />
        </FormField>

        <FormField label={t("orderNo")} htmlFor="salesOrderNo" error={errors.orderNo?.message}>
          <Input id="salesOrderNo" {...register("orderNo")} />
        </FormField>

        <FormField label={t("invoiceAmount")} htmlFor="salesInvoiceAmount" required error={errors.invoiceAmount?.message}>
          <Input id="salesInvoiceAmount" type="number" min={0} step="0.01" {...register("invoiceAmount")} />
        </FormField>

        <FormField label={t("amountReceived")} htmlFor="salesAmountReceived" required error={errors.amountReceived?.message}>
          <Input id="salesAmountReceived" type="number" min={0} step="0.01" {...register("amountReceived")} />
        </FormField>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-600">
            {t("balance")}: <span className="font-medium text-slate-900">{formatCurrency(balance)}</span>
          </span>
          <SalesPaymentStatusBadge status={status} />
        </div>

        <FormField label={t("remark")} htmlFor="salesRemark" error={errors.remark?.message}>
          <Textarea id="salesRemark" rows={3} {...register("remark")} />
        </FormField>
      </form>
    </Modal>
  )
}
