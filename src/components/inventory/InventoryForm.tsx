"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { ImageOff } from "lucide-react"
import { SparePartSchema, type SparePartInput } from "@/lib/schemas"
import { createSparePart, updateSparePart } from "@/lib/actions/inventory"
import { FormField, Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FileUploader } from "@/components/ui/file-uploader"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { STOCK_TYPE_LABELS, itemNameTranslationKey } from "@/lib/stock-types"
import type { StockType } from "@/lib/stock-types"

interface InventoryFormProps {
  stockType: StockType
  defaultValues?: Partial<SparePartInput>
  partId?: string
  imageUrl?: string | null
}

async function uploadSparePartImage(partId: string, file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`/api/stock/${partId}/image`, { method: "POST", body: formData })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Failed to upload picture")
  return json.imageUrl as string
}

export function InventoryForm({ stockType, defaultValues, partId, imageUrl }: InventoryFormProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(partId)
  const itemNameKey = itemNameTranslationKey(stockType)
  const [image, setImage] = useState(imageUrl ?? null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SparePartInput>({
    resolver: zodResolver(SparePartSchema) as Resolver<SparePartInput>,
    defaultValues: {
      partNumber: "",
      name: "",
      category: "GENERAL",
      brand: "",
      quantity: 0,
      ...defaultValues,
    },
  })

  async function onSubmit(data: SparePartInput) {
    setFormError(null)

    if (isEdit) {
      const result = await updateSparePart(partId!, data)
      if (result?.error) {
        setFormError(result.error)
        toast.error(result.error)
      }
      return
    }

    const result = await createSparePart(data)
    if ("error" in result) {
      setFormError(result.error)
      toast.error(result.error)
      return
    }

    if (pendingFile) {
      try {
        await uploadSparePartImage(result.id, pendingFile)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Item created, but picture upload failed")
      }
    }

    router.push(`/stock?type=${stockType}`)
  }

  async function handlePictureSelect(file: File) {
    if (isEdit) {
      try {
        const url = await uploadSparePartImage(partId!, file)
        setImage(`${url}?t=${Date.now()}`)
        toast.success("Picture updated")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to upload picture")
      }
      return
    }

    setPendingFile(file)
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input type="hidden" {...register("category")} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-900">{STOCK_TYPE_LABELS[stockType]}</h2>

        <FormField label={t(itemNameKey)} htmlFor="name" required error={errors.name?.message}>
          <Input id="name" {...register("name")} error={errors.name?.message} />
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("brand")} htmlFor="brand" required error={errors.brand?.message}>
            <Input id="brand" placeholder="e.g. HP, Canon, Ricoh" {...register("brand")} error={errors.brand?.message} />
          </FormField>
          <FormField label={t("quantity")} htmlFor="quantity" required error={errors.quantity?.message}>
            <Input id="quantity" type="number" min="0" step="1" {...register("quantity")} error={errors.quantity?.message} />
          </FormField>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Picture</p>
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {image ? (
                <Image src={image} alt={defaultValues?.name ?? "Item picture"} width={80} height={80} className="h-full w-full object-cover" unoptimized />
              ) : (
                <ImageOff className="h-7 w-7 text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <FileUploader onUpload={handlePictureSelect} label="Drag & drop a picture, or click to browse" />
            </div>
          </div>
        </div>
      </div>

      {formError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  )
}
