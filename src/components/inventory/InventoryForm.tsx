"use client"

import { useState } from "react"
import Image from "next/image"
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

export function InventoryForm({ stockType, defaultValues, partId, imageUrl }: InventoryFormProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(partId)
  const itemNameKey = itemNameTranslationKey(stockType)
  const [image, setImage] = useState(imageUrl ?? null)

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
    const result = isEdit
      ? await updateSparePart(partId!, data)
      : await createSparePart(data)
    if (result?.error) {
      toast.error(result.error)
    }
  }

  async function handleImageUpload(file: File) {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch(`/api/stock/${partId}/image`, { method: "POST", body: formData })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? "Failed to upload picture")
      return
    }
    setImage(`${json.imageUrl}?t=${Date.now()}`)
    toast.success("Picture updated")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input type="hidden" {...register("category")} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-900">{STOCK_TYPE_LABELS[stockType]}</h2>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Picture</p>
          {isEdit ? (
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {image ? (
                  <Image src={image} alt={defaultValues?.name ?? "Item picture"} width={80} height={80} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <ImageOff className="h-7 w-7 text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <FileUploader onUpload={handleImageUpload} label="Drag & drop a picture, or click to browse" />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Save this item first, then add a picture from its page.</p>
          )}
        </div>

        <FormField label={t(itemNameKey)} htmlFor="name" required error={errors.name?.message}>
          <Input id="name" {...register("name")} error={errors.name?.message} />
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("brand")} htmlFor="brand" error={errors.brand?.message}>
            <Input id="brand" placeholder="e.g. HP, Canon, Ricoh" {...register("brand")} />
          </FormField>
          <FormField label={t("quantity")} htmlFor="quantity" error={errors.quantity?.message}>
            <Input id="quantity" type="number" min="0" step="1" {...register("quantity")} error={errors.quantity?.message} />
          </FormField>
        </div>
      </div>

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
