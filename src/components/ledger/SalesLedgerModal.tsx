"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { SalesLedgerEntrySchema, type SalesLedgerEntryInput } from "@/lib/schemas"
import { createSalesLedgerEntry, updateSalesLedgerEntry } from "@/lib/actions/ledger"
import { computeSalesLedgerStatus } from "@/lib/ledger-utils"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SalesPaymentStatusBadge } from "@/components/ui/badge"
import { CustomerSearchInput } from "@/components/ui/customer-search-input"
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

  // Customer search display state (drives the search input)
  const [customerDisplayName, setCustomerDisplayName] = useState(entry?.customerName ?? "")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(entry?.customerId ?? "")

  function makeDefaults(e?: SalesLedgerListItem): SalesLedgerEntryInput {
    return e
      ? {
          date: new Date(e.date).toISOString().slice(0, 10),
          customerId: e.customerId ?? "",
          customerName: e.customerName,
          orderNo: e.orderNo ?? "",
          invoiceAmount: e.invoiceAmount,
          amountReceived: e.amountReceived,
          remark: e.remark ?? "",
        }
      : {
          date: todayIso(),
          customerId: "",
          customerName: "",
          orderNo: "",
          invoiceAmount: "" as unknown as number,
          amountReceived: "" as unknown as number,
          remark: "",
        }
  }

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SalesLedgerEntryInput>({
    resolver: zodResolver(SalesLedgerEntrySchema) as Resolver<SalesLedgerEntryInput>,
    defaultValues: makeDefaults(entry),
  })

  useEffect(() => {
    if (isOpen) {
      const defaults = makeDefaults(entry)
      reset(defaults)
      setCustomerDisplayName(entry?.customerName ?? "")
      setSelectedCustomerId(entry?.customerId ?? "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry])

  const invoiceRaw = watch("invoiceAmount")
  const receivedRaw = watch("amountReceived")
  const invoiceAmount = Number(invoiceRaw) || 0
  const amountReceived = Number(receivedRaw) || 0
  const { balance, status } = computeSalesLedgerStatus(invoiceAmount, amountReceived)
  // Once a receipt has been allocated to this invoice (via the Ledger Income form),
  // amountReceived is owned by that allocation total — editing it here would silently
  // get overwritten on the next recompute, so lock it and point to the real source.
  const hasAllocations = Boolean(entry?._count?.allocations)

  function handleCustomerChange(name: string, customerId: string) {
    setCustomerDisplayName(name)
    setSelectedCustomerId(customerId)
    setValue("customerName", name, { shouldValidate: name.length > 0 })
    setValue("customerId", customerId)
  }

  function handleClose() {
    reset()
    setCustomerDisplayName("")
    setSelectedCustomerId("")
    onClose()
  }

  async function onSubmit(data: SalesLedgerEntryInput) {
    const result = isEditing
      ? await updateSalesLedgerEntry(entry!.id, data)
      : await createSalesLedgerEntry(data)

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
        {/* Hidden inputs so RHF tracks customerName and customerId */}
        <input type="hidden" {...register("customerName")} />
        <input type="hidden" {...register("customerId")} />

        <FormField label={t("date")} htmlFor="salesDate" required error={errors.date?.message}>
          <Input id="salesDate" type="date" {...register("date")} />
        </FormField>

        <FormField
          label={t("salesCustomerName")}
          htmlFor="salesCustomerSearch"
          required
          error={errors.customerName?.message}
        >
          <CustomerSearchInput
            value={customerDisplayName}
            onChange={handleCustomerChange}
            error={errors.customerName?.message}
          />
        </FormField>

        <FormField label={t("orderNo")} htmlFor="salesOrderNo" error={errors.orderNo?.message}>
          <Input id="salesOrderNo" {...register("orderNo")} />
        </FormField>

        <FormField label={t("invoiceAmount")} htmlFor="salesInvoiceAmount" required error={errors.invoiceAmount?.message}>
          <MoneyInput
            id="salesInvoiceAmount"
            {...register("invoiceAmount")}
          />
        </FormField>

        <FormField
          label={t("amountReceived")}
          htmlFor="salesAmountReceived"
          error={errors.amountReceived?.message}
          hint={hasAllocations ? t("amountReceivedLockedHint") : undefined}
        >
          <MoneyInput
            id="salesAmountReceived"
            selectOnFocus
            disabled={hasAllocations}
            {...register("amountReceived")}
          />
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
