"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { LedgerEntrySchema, type LedgerEntryInput } from "@/lib/schemas"
import { createLedgerEntry, updateLedgerEntry } from "@/lib/actions/ledger"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { CustomerSearchInput } from "@/components/ui/customer-search-input"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { formatCurrency } from "@/lib/utils"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { LedgerCategory, LedgerEntryType, LedgerEntryWithRelations } from "@/types"
import type { AllocatableSalesLedgerEntry } from "@/lib/data/ledger"

// General Ledger only ever offers these 4 methods (CARD/OTHER were added to the
// shared Prisma enum for the new Shop Account module, not this one).
type GeneralLedgerPaymentMethod = "MPESA" | "BANK_TRANSFER" | "CHEQUE" | "CASH"

const NEW_CATEGORY_VALUE = "__new__"
const PAYMENT_METHODS: GeneralLedgerPaymentMethod[] = ["MPESA", "BANK_TRANSFER", "CHEQUE", "CASH"]
const PAYMENT_METHOD_KEYS: Record<GeneralLedgerPaymentMethod, TranslationKey> = {
  MPESA: "paymentMethodMpesa",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  CASH: "paymentMethodCash",
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface LedgerEntryModalProps {
  isOpen: boolean
  onClose: () => void
  categories: LedgerCategory[]
  defaultType: LedgerEntryType
  entry?: LedgerEntryWithRelations
  /** Gates the "Apply to Sales Records" panel — hidden entirely for users without ledger.receipts.allocate, who can still create a plain Income entry. */
  canAllocate: boolean
}

export function LedgerEntryModal({ isOpen, onClose, categories, defaultType, entry, canAllocate }: LedgerEntryModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const isEditing = Boolean(entry)

  const [customerDisplayName, setCustomerDisplayName] = useState(entry?.customer?.companyName ?? "")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(entry?.customerId ?? "")
  const [unpaidEntries, setUnpaidEntries] = useState<AllocatableSalesLedgerEntry[]>([])
  const [loadingUnpaid, setLoadingUnpaid] = useState(false)
  // salesLedgerEntryId -> input string. Seeded from the entry's own existing
  // allocations when editing, so adjusting a past receipt shows what was allocated.
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>(
    Object.fromEntries((entry?.allocations ?? []).map((a) => [a.salesLedgerEntryId, String(a.amount)]))
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LedgerEntryInput>({
    resolver: zodResolver(LedgerEntrySchema) as Resolver<LedgerEntryInput>,
    defaultValues: entry
      ? {
          type: entry.type,
          categoryId: entry.categoryId,
          date: new Date(entry.date).toISOString().slice(0, 10),
          amount: entry.amount,
          paymentMethod: entry.paymentMethod as GeneralLedgerPaymentMethod,
          remark: entry.remark ?? "",
        }
      : { type: defaultType, categoryId: "", date: todayIso(), paymentMethod: "CASH", remark: "" },
  })

  useEffect(() => {
    if (!isOpen) return
    reset(
      entry
        ? {
            type: entry.type,
            categoryId: entry.categoryId,
            date: new Date(entry.date).toISOString().slice(0, 10),
            amount: entry.amount,
            paymentMethod: entry.paymentMethod as GeneralLedgerPaymentMethod,
            remark: entry.remark ?? "",
          }
        : { type: defaultType, categoryId: "", date: todayIso(), paymentMethod: "CASH", remark: "" }
    )
    setCustomerDisplayName(entry?.customer?.companyName ?? "")
    setSelectedCustomerId(entry?.customerId ?? "")
    setAllocationInputs(Object.fromEntries((entry?.allocations ?? []).map((a) => [a.salesLedgerEntryId, String(a.amount)])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry, defaultType])

  const selectedType = watch("type")
  const selectedCategoryId = watch("categoryId")
  const amountRaw = watch("amount")
  const receiptAmount = Number(amountRaw) || 0
  const categoriesForType = categories.filter((c) => c.type === selectedType)
  const showAllocationPanel = canAllocate && selectedType === "INCOME" && Boolean(selectedCustomerId)

  // Fetch the selected customer's unpaid/partial Sales Ledger entries whenever the
  // customer changes. On first open while editing, also merge in the entry's own
  // previously-allocated invoices even if they've since become fully paid elsewhere,
  // so the existing allocation rows don't just disappear from the panel.
  useEffect(() => {
    if (!showAllocationPanel || !selectedCustomerId) {
      setUnpaidEntries([])
      return
    }
    let cancelled = false
    setLoadingUnpaid(true)
    fetch(`/api/ledger/sales/unpaid?customerId=${encodeURIComponent(selectedCustomerId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setUnpaidEntries(data.entries ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoadingUnpaid(false)
      })
    return () => {
      cancelled = true
    }
  }, [showAllocationPanel, selectedCustomerId])

  function handleCustomerChange(name: string, customerId: string) {
    setCustomerDisplayName(name)
    setSelectedCustomerId(customerId)
    if (customerId !== selectedCustomerId) setAllocationInputs({})
  }

  function setAllocation(salesLedgerEntryId: string, value: string) {
    setAllocationInputs((prev) => ({ ...prev, [salesLedgerEntryId]: value }))
  }

  const allocations = Object.entries(allocationInputs)
    .map(([salesLedgerEntryId, raw]) => ({ salesLedgerEntryId, amount: Number(raw) || 0 }))
    .filter((a) => a.amount > 0)
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0)
  const unallocated = receiptAmount - totalAllocated

  function handleClose() {
    reset()
    setCustomerDisplayName("")
    setSelectedCustomerId("")
    setAllocationInputs({})
    onClose()
  }

  async function onSubmit(data: LedgerEntryInput) {
    if (totalAllocated > receiptAmount + 0.001) {
      toast.error(t("allocationExceedsReceipt"))
      return
    }
    const payload: LedgerEntryInput = {
      ...data,
      customerId: data.type === "INCOME" ? selectedCustomerId : "",
      allocations: data.type === "INCOME" ? allocations : [],
    }
    const result = isEditing ? await updateLedgerEntry(entry!.id, payload) : await createLedgerEntry(payload)
    if (result?.error) {
      toast.error(result.error === "ALLOCATION_EXCEEDS_BALANCE" ? t("allocationExceedsBalance") : result.error)
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
      title={isEditing ? t("editEntry") : selectedType === "INCOME" ? t("addIncome") : t("addExpense")}
      size={showAllocationPanel ? "lg" : "md"}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="ledger-entry-form" loading={isSubmitting}>
            {t("save")}
          </Button>
        </div>
      }
    >
      <form id="ledger-entry-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label={t("type")} htmlFor="entryType" required error={errors.type?.message}>
          <Select
            id="entryType"
            {...register("type")}
            onChange={(e) => {
              setValue("type", e.target.value as LedgerEntryType)
              setValue("categoryId", "")
              if (e.target.value !== "INCOME") {
                setSelectedCustomerId("")
                setCustomerDisplayName("")
                setAllocationInputs({})
              }
            }}
          >
            <option value="INCOME">{t("income")}</option>
            <option value="EXPENSE">{t("expense")}</option>
          </Select>
        </FormField>

        <FormField label={t("category")} htmlFor="entryCategory" required error={errors.categoryId?.message}>
          <Select id="entryCategory" {...register("categoryId")}>
            <option value="" disabled>
              {t("category")}
            </option>
            {categoriesForType.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value={NEW_CATEGORY_VALUE}>{t("newCategory")}</option>
          </Select>
        </FormField>

        {selectedCategoryId === NEW_CATEGORY_VALUE && (
          <FormField label={t("categoryName")} htmlFor="newCategoryName" required error={errors.newCategoryName?.message}>
            <Input id="newCategoryName" {...register("newCategoryName")} />
          </FormField>
        )}

        <FormField label={t("date")} htmlFor="entryDate" required error={errors.date?.message}>
          <Input id="entryDate" type="date" {...register("date")} />
        </FormField>

        <FormField label={t("amount")} htmlFor="entryAmount" required error={errors.amount?.message}>
          <MoneyInput
            id="entryAmount"
            {...register("amount")}
          />
        </FormField>

        <FormField
          label={selectedType === "INCOME" ? t("receivingMethod") : t("paymentMethod")}
          htmlFor="entryPaymentMethod"
          required
          error={errors.paymentMethod?.message}
        >
          <Select id="entryPaymentMethod" {...register("paymentMethod")}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{t(PAYMENT_METHOD_KEYS[m])}</option>
            ))}
          </Select>
        </FormField>

        {canAllocate && selectedType === "INCOME" && (
          <FormField label={t("customer")} htmlFor="entryCustomer">
            <CustomerSearchInput value={customerDisplayName} onChange={handleCustomerChange} />
          </FormField>
        )}

        {showAllocationPanel && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-900">{t("applyToSalesRecords")}</p>
            {loadingUnpaid ? (
              <p className="text-xs text-slate-400">…</p>
            ) : unpaidEntries.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{t("noUnpaidInvoicesForCustomer")}</p>
            ) : (
              <div className="space-y-2">
                <div className="hidden sm:grid sm:grid-cols-4 gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>{t("invoiceNumberLabel")}</span>
                  <span className="text-right">{t("invoiceAmount")}</span>
                  <span className="text-right">{t("balance")}</span>
                  <span className="text-right">{t("allocateAmount")}</span>
                </div>
                {unpaidEntries.map((se) => (
                  <div key={se.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-sm">
                    <span className="font-mono text-xs text-slate-700">{se.orderNo ?? "—"}</span>
                    <span className="text-right text-slate-600">{formatCurrency(se.invoiceAmount)}</span>
                    <span className="text-right text-slate-600">{formatCurrency(se.balance)}</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="text-right"
                      placeholder="0.00"
                      value={allocationInputs[se.id] ?? ""}
                      onChange={(e) => setAllocation(se.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-500">{t("receiptAmount")}: <span className="font-medium text-slate-900">{formatCurrency(receiptAmount)}</span></span>
              <span className="text-slate-500">{t("allocatedAmount")}: <span className="font-medium text-slate-900">{formatCurrency(totalAllocated)}</span></span>
              <span className={unallocated < 0 ? "text-red-600 font-medium" : "text-slate-500"}>
                {t("unallocatedAmount")}: <span className="font-medium">{formatCurrency(unallocated)}</span>
              </span>
            </div>
          </div>
        )}

        <FormField label={t("remark")} htmlFor="entryRemark" error={errors.remark?.message}>
          <Textarea id="entryRemark" rows={3} {...register("remark")} />
        </FormField>
      </form>
    </Modal>
  )
}
