"use client"

import { useEffect, useRef, useState } from "react"
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

interface CustomerOption {
  id: string
  companyName: string
  name: string | null
  code: string
}

interface CustomerSearchInputProps {
  value: string
  onChange: (name: string, customerId: string) => void
  error?: string
}

function CustomerSearchInput({ value, onChange, error }: CustomerSearchInputProps) {
  const [results, setResults] = useState<CustomerOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val, "")

    if (timerRef.current) clearTimeout(timerRef.current)
    if (!val.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(val.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.customers ?? [])
          setOpen(true)
        }
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function select(c: CustomerOption) {
    setResults([])
    setOpen(false)
    onChange(c.companyName, c.id)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={handleChange}
        placeholder="Type to search customers or enter name…"
        className={error ? "border-red-400" : ""}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-baseline gap-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(c)}
              >
                <span className="font-medium text-slate-900">{c.companyName}</span>
                {c.name && <span className="text-xs text-slate-500">{c.name}</span>}
                <span className="text-xs text-slate-400 ml-auto">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && value.trim() && (
        <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-sm mt-1 px-3 py-2 text-sm text-slate-400">
          No customers found — name will be saved as entered.
        </div>
      )}
    </div>
  )
}

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
          <Input
            id="salesInvoiceAmount"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            {...register("invoiceAmount")}
          />
        </FormField>

        <FormField label={t("amountReceived")} htmlFor="salesAmountReceived" error={errors.amountReceived?.message}>
          <Input
            id="salesAmountReceived"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
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
