"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { Paperclip, X as XIcon } from "lucide-react"
import { ShopAccountEntrySchema, type ShopAccountEntryInput } from "@/lib/schemas"
import { createShopAccountEntry, updateShopAccountEntry } from "@/lib/actions/shopAccount"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { FileUploader } from "@/components/ui/file-uploader"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE } from "@/lib/constants"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { ShopAccountCategory } from "@/types"
import type { ShopAccountEntryWithRelations } from "@/lib/data/shopAccount"
import type { LedgerEntryType, LedgerPaymentMethod } from "@/types"

const NEW_CATEGORY_VALUE = "__new__"
const PAYMENT_METHODS: LedgerPaymentMethod[] = ["CASH", "MPESA", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]
const PAYMENT_METHOD_KEYS: Record<LedgerPaymentMethod, TranslationKey> = {
  MPESA: "paymentMethodMpesa",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  CASH: "paymentMethodCash",
  CARD: "paymentMethodCard",
  OTHER: "paymentMethodOther",
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function uploadAttachment(entryId: string, file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`/api/ledger/shop/${entryId}/attachment`, { method: "POST", body: formData })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Failed to upload attachment")
  return json as { attachmentUrl: string; attachmentFileName: string }
}

async function removeAttachment(entryId: string) {
  const res = await fetch(`/api/ledger/shop/${entryId}/attachment`, { method: "DELETE" })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? "Failed to remove attachment")
  }
}

interface ShopAccountEntryModalProps {
  isOpen: boolean
  onClose: () => void
  categories: ShopAccountCategory[]
  defaultType: LedgerEntryType
  entry?: ShopAccountEntryWithRelations
}

export function ShopAccountEntryModal({ isOpen, onClose, categories, defaultType, entry }: ShopAccountEntryModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const isEditing = Boolean(entry)

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(
    entry?.attachmentUrl ? { url: entry.attachmentUrl, name: entry.attachmentFileName ?? "Attachment" } : null
  )
  const [attachmentBusy, setAttachmentBusy] = useState(false)

  const defaultValues = (): ShopAccountEntryInput =>
    entry
      ? {
          date: new Date(entry.date).toISOString().slice(0, 10),
          type: entry.type,
          categoryId: entry.categoryId,
          description: entry.description,
          payee: entry.payee ?? "",
          amount: entry.amount,
          paymentMethod: entry.paymentMethod as ShopAccountEntryInput["paymentMethod"],
          remarks: entry.remarks ?? "",
        }
      : {
          date: todayIso(),
          type: defaultType,
          categoryId: "",
          description: "",
          payee: "",
          amount: 0,
          paymentMethod: "CASH",
          remarks: "",
        }

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShopAccountEntryInput>({
    resolver: zodResolver(ShopAccountEntrySchema) as Resolver<ShopAccountEntryInput>,
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!isOpen) return
    reset(defaultValues())
    setAttachment(entry?.attachmentUrl ? { url: entry.attachmentUrl, name: entry.attachmentFileName ?? "Attachment" } : null)
    setPendingFile(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry, defaultType])

  const selectedType = watch("type")
  const selectedCategoryId = watch("categoryId")
  const categoriesForType = categories.filter((c) => c.type === selectedType)

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFileSelect(file: File) {
    if (isEditing) {
      setAttachmentBusy(true)
      try {
        const result = await uploadAttachment(entry!.id, file)
        setAttachment({ url: result.attachmentUrl, name: result.attachmentFileName })
        toast.success(t("attachmentUploaded"))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to upload attachment")
      } finally {
        setAttachmentBusy(false)
      }
      return
    }
    setPendingFile(file)
    setAttachment({ url: URL.createObjectURL(file), name: file.name })
  }

  async function handleRemoveAttachment() {
    if (isEditing) {
      setAttachmentBusy(true)
      try {
        await removeAttachment(entry!.id)
        setAttachment(null)
        toast.success(t("attachmentRemoved"))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove attachment")
      } finally {
        setAttachmentBusy(false)
      }
      return
    }
    setPendingFile(null)
    setAttachment(null)
  }

  async function onSubmit(data: ShopAccountEntryInput) {
    if (isEditing) {
      const result = await updateShopAccountEntry(entry!.id, data)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(t("recordUpdated"))
      handleClose()
      router.refresh()
      return
    }

    const result = await createShopAccountEntry(data)
    if ("error" in result) {
      toast.error(result.error)
      return
    }

    if (pendingFile) {
      try {
        await uploadAttachment(result.id, pendingFile)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Record saved, but attachment upload failed")
      }
    }

    toast.success(t("recordSaved"))
    handleClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? t("editEntry") : selectedType === "INCOME" ? t("addIncome") : t("addExpense")}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="shop-account-entry-form" loading={isSubmitting}>
            {t("save")}
          </Button>
        </div>
      }
    >
      <form id="shop-account-entry-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("type")} htmlFor="saType" required error={errors.type?.message}>
            <div
              id="saType"
              className="block w-full select-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 sm:py-2"
            >
              {selectedType === "INCOME" ? t("income") : t("expense")}
            </div>
            <input type="hidden" {...register("type")} />
          </FormField>
          <FormField label={t("date")} htmlFor="saDate" required error={errors.date?.message}>
            <Input id="saDate" type="date" {...register("date")} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("category")} htmlFor="saCategory" required error={errors.categoryId?.message}>
            <Select id="saCategory" {...register("categoryId")}>
              <option value="" disabled>{t("category")}</option>
              {categoriesForType.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={NEW_CATEGORY_VALUE}>{t("newCategory")}</option>
            </Select>
          </FormField>
          <FormField label={t("amount")} htmlFor="saAmount" required error={errors.amount?.message}>
            <MoneyInput id="saAmount" selectOnFocus {...register("amount")} />
          </FormField>
        </div>

        {selectedCategoryId === NEW_CATEGORY_VALUE && (
          <FormField label={t("categoryName")} htmlFor="saNewCategoryName" required error={errors.newCategoryName?.message}>
            <Input id="saNewCategoryName" {...register("newCategoryName")} />
          </FormField>
        )}

        <FormField label={t("description")} htmlFor="saDescription" required error={errors.description?.message}>
          <Input id="saDescription" placeholder="e.g. Toner purchase for HP printers" {...register("description")} />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("supplierPayee")} htmlFor="saPayee" error={errors.payee?.message}>
            <Input id="saPayee" {...register("payee")} />
          </FormField>
          <FormField label={t("paymentMethod")} htmlFor="saPaymentMethod" required error={errors.paymentMethod?.message}>
            <Select id="saPaymentMethod" {...register("paymentMethod")}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{t(PAYMENT_METHOD_KEYS[m])}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label={t("remark")} htmlFor="saRemarks" error={errors.remarks?.message}>
          <Textarea id="saRemarks" rows={2} {...register("remarks")} />
        </FormField>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">{t("attachment")}</p>
          {attachment ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
              <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-blue-600 hover:underline">
                {attachment.name}
              </a>
              <Button type="button" variant="outline" size="sm" loading={attachmentBusy} icon={<XIcon className="h-3.5 w-3.5" />} onClick={handleRemoveAttachment}>
                {t("removePicture")}
              </Button>
            </div>
          ) : (
            <FileUploader
              onUpload={handleFileSelect}
              label={t("attachmentUploadLabel")}
              allowedTypes={ALLOWED_DOCUMENT_TYPES}
              maxSize={MAX_DOCUMENT_SIZE}
              acceptLabel="JPG, PNG, WEBP, PDF — max 10MB"
              typeErrorMessage="Only JPG, PNG, WEBP, and PDF files are allowed"
              disabled={attachmentBusy}
            />
          )}
        </div>
      </form>
    </Modal>
  )
}
