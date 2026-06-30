"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { LedgerEntrySchema, type LedgerEntryInput } from "@/lib/schemas"
import { createLedgerEntry, updateLedgerEntry } from "@/lib/actions/ledger"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { LedgerCategory, LedgerEntryType, LedgerEntryWithRelations, LedgerPaymentMethod } from "@/types"

const NEW_CATEGORY_VALUE = "__new__"
const PAYMENT_METHODS: LedgerPaymentMethod[] = ["MPESA", "BANK_TRANSFER", "CHEQUE", "CASH"]
const PAYMENT_METHOD_KEYS: Record<LedgerPaymentMethod, TranslationKey> = {
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
}

export function LedgerEntryModal({ isOpen, onClose, categories, defaultType, entry }: LedgerEntryModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const isEditing = Boolean(entry)

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
          paymentMethod: entry.paymentMethod,
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
            paymentMethod: entry.paymentMethod,
            remark: entry.remark ?? "",
          }
        : { type: defaultType, categoryId: "", date: todayIso(), paymentMethod: "CASH", remark: "" }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry, defaultType])

  const selectedType = watch("type")
  const selectedCategoryId = watch("categoryId")
  const categoriesForType = categories.filter((c) => c.type === selectedType)

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(data: LedgerEntryInput) {
    const result = isEditing ? await updateLedgerEntry(entry!.id, data) : await createLedgerEntry(data)
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
      title={isEditing ? t("editEntry") : selectedType === "INCOME" ? t("addIncome") : t("addExpense")}
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
          <Input
            id="entryAmount"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
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

        <FormField label={t("remark")} htmlFor="entryRemark" error={errors.remark?.message}>
          <Textarea id="entryRemark" rows={3} {...register("remark")} />
        </FormField>
      </form>
    </Modal>
  )
}
