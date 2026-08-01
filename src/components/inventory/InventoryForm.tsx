"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { ImageOff, X as XIcon } from "lucide-react"
import { SparePartSchema, type SparePartInput } from "@/lib/schemas"
import { createSparePart, updateSparePart } from "@/lib/actions/inventory"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { FileUploader } from "@/components/ui/file-uploader"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { STOCK_TYPE_LABELS } from "@/lib/stock-types"
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

async function removeSparePartImage(partId: string) {
  const res = await fetch(`/api/stock/${partId}/image`, { method: "DELETE" })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? "Failed to remove picture")
  }
}

export function InventoryForm({ stockType, defaultValues, partId, imageUrl }: InventoryFormProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(partId)
  const [image, setImage] = useState(imageUrl ?? null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [removingImage, setRemovingImage] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SparePartInput>({
    resolver: zodResolver(SparePartSchema) as Resolver<SparePartInput>,
    defaultValues: {
      name: "",
      model: "",
      specification: "",
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
        toast.success(t("pictureUpdated"))
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

  async function handleRemovePicture() {
    if (isEdit) {
      setRemovingImage(true)
      try {
        await removeSparePartImage(partId!)
        setImage(null)
        toast.success(t("pictureRemoved"))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove picture")
      } finally {
        setRemovingImage(false)
      }
      return
    }
    if (image) URL.revokeObjectURL(image)
    setImage(null)
    setPendingFile(null)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input type="hidden" {...register("category")} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-900">{STOCK_TYPE_LABELS[stockType]}</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("brand")} htmlFor="brand" required error={errors.brand?.message}>
            <Input id="brand" placeholder="e.g. HP, Canon, Ricoh" {...register("brand")} error={errors.brand?.message} />
          </FormField>
          <FormField label={t("name")} htmlFor="name" required error={errors.name?.message}>
            <Input id="name" {...register("name")} error={errors.name?.message} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("model")} htmlFor="model" error={errors.model?.message}>
            <Input id="model" placeholder="e.g. M428fdw" {...register("model")} error={errors.model?.message} />
          </FormField>
          <FormField label={t("quantity")} htmlFor="quantity" required error={errors.quantity?.message}>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              className="no-spinner"
              onFocus={(e) => e.currentTarget.select()}
              {...register("quantity")}
              error={errors.quantity?.message}
            />
          </FormField>
        </div>

        <FormField label={t("specification")} htmlFor="specification" error={errors.specification?.message}>
          <Textarea
            id="specification"
            rows={3}
            placeholder="e.g. Compatible with HP LaserJet Pro / additional notes"
            {...register("specification")}
          />
        </FormField>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">{t("picture")}</p>
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => image && setPreviewOpen(true)}
              disabled={!image}
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 disabled:cursor-default"
            >
              {image ? (
                <Image src={image} alt={defaultValues?.name ?? "Item picture"} width={80} height={80} className="h-full w-full object-cover" unoptimized />
              ) : (
                <ImageOff className="h-7 w-7 text-slate-300" />
              )}
            </button>
            <div className="flex-1 space-y-2">
              <FileUploader onUpload={handlePictureSelect} label="Drag & drop a picture, or click to browse" />
              {image && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={removingImage}
                  icon={<XIcon className="h-3.5 w-3.5" />}
                  onClick={handleRemovePicture}
                >
                  {t("removePicture")}
                </Button>
              )}
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

      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title={t("viewPicture")} size="md">
        {image && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={defaultValues?.name ?? "Item picture"} className="max-h-[70vh] w-auto rounded-lg object-contain" />
          </div>
        )}
      </Modal>
    </form>
  )
}
