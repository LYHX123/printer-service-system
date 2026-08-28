"use client"

import { useEffect, useMemo } from "react"
import Image from "next/image"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { ImageOff, Trash2 } from "lucide-react"
import { DeliverySchema, type DeliveryInput } from "@/lib/schemas"
import { createDelivery, updateDelivery } from "@/lib/actions/deliveries"
import type { StockShortfall } from "@/lib/actions/deliveries"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { CustomerSearchSelect } from "@/components/ui/customer-search-select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { todayLocalDate } from "@/lib/utils"
import { selectOnFocus } from "@/lib/input-helpers"
import type { SparePartOption } from "@/lib/data/inventory"
import { getStockType, STOCK_TYPE_TRANSLATION_KEYS } from "@/lib/stock-types"
import { StockItemSearch } from "@/components/quotations/StockItemSearch"

interface CustomerProjectOption {
  id: string
  name: string
}

interface CustomerOption {
  id: string
  name: string | null
  code: string
  companyName: string
  shortName: string | null
  branches: CustomerProjectOption[]
}

interface DeliveryFormProps {
  customers: CustomerOption[]
  spareParts: SparePartOption[]
  defaultValues?: Partial<DeliveryInput>
  deliveryId?: string
}

export function DeliveryForm({ customers, spareParts, defaultValues, deliveryId }: DeliveryFormProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(deliveryId)

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DeliveryInput>({
    resolver: zodResolver(DeliverySchema) as Resolver<DeliveryInput>,
    defaultValues: {
      items: [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  // Same reasoning as QuotationForm/DirectInvoiceForm — default to today in
  // the browser's local timezone, computed after mount to avoid SSR/client
  // hydration mismatch, create-only so editing never overwrites the date.
  useEffect(() => {
    if (!isEdit) setValue("deliveryDate", todayLocalDate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedCustomerId = watch("customerId")
  const watchedItems = watch("items")
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  function handleCustomerChange() {
    setValue("customerBranchId", "")
  }

  const partsById = useMemo(() => new Map(spareParts.map((p) => [p.id, p])), [spareParts])

  function addStockItem(part: SparePartOption) {
    append({ partId: part.id, quantity: 1 })
  }

  async function onSubmit(data: DeliveryInput) {
    const result = isEdit ? await updateDelivery(deliveryId!, data) : await createDelivery(data)
    if (result?.error) {
      if (result.shortfalls?.length) {
        const detail = (result.shortfalls as StockShortfall[])
          .map((s) => `${s.name}: have ${s.have}, need ${s.need}`)
          .join("; ")
        toast.error(`${result.error} — ${detail}`)
      } else {
        toast.error(result.error)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-5">
        {/* Customer */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">{t("customer")}</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label={t("deliveryDateLabel")} htmlFor="deliveryDate" required error={errors.deliveryDate?.message}>
              <Input id="deliveryDate" type="date" {...register("deliveryDate")} />
            </FormField>
            <FormField label={t("customer")} htmlFor="customerId" required error={errors.customerId?.message}>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <CustomerSearchSelect
                    id="customerId"
                    customers={customers}
                    value={field.value}
                    onChange={(customerId) => {
                      field.onChange(customerId)
                      handleCustomerChange()
                    }}
                    error={errors.customerId?.message}
                  />
                )}
              />
            </FormField>
          </div>

          {selectedCustomer && selectedCustomer.branches.length > 0 && (
            <FormField label={t("projectLabel")} htmlFor="customerBranchId">
              <Select id="customerBranchId" {...register("customerBranchId")}>
                <option value="">{t("headOffice")}</option>
                {selectedCustomer.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label={t("referenceOptionalLabel")} htmlFor="reference" error={errors.reference?.message}>
            <Input id="reference" {...register("reference")} />
          </FormField>
        </div>

        {/* Stock Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{t("deliveryItemsHeading")}</h2>

          <StockItemSearch spareParts={spareParts} onSelect={addStockItem} />

          {errors.items?.message && <p className="text-xs text-red-600">{errors.items.message}</p>}

          {fields.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">{t("noItemsAdded")}</p>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 pb-1 border-b border-slate-100">
                <div className="col-span-8">{t("itemColumnLabel")}</div>
                <div className="col-span-3 text-right">{t("quantity")}</div>
                <div className="col-span-1" />
              </div>
              {fields.map((field, index) => {
                const itemPartId = watchedItems?.[index]?.partId
                const part = itemPartId ? partsById.get(itemPartId) : undefined
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start sm:items-center">
                    <div className="col-span-12 sm:col-span-8 flex items-center gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {part?.imageUrl ? (
                          <Image src={part.imageUrl} alt={part.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          <ImageOff className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {part ? (part.brand ? `${part.brand} — ${part.name}` : part.name) : t("unknownItem")}
                          </p>
                          {part && (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                              {t(STOCK_TYPE_TRANSLATION_KEYS[getStockType(part.category)])}
                            </span>
                          )}
                        </div>
                        {part && (
                          <p className="text-xs text-slate-400 truncate">
                            {part.model ? `${part.model} · ` : ""}
                            {t("inStockCount")
                              .replace("{qty}", String(part.stock?.quantity ?? 0))
                              .replace("{unit}", part.unit || t("genericUnitsFallback"))}
                          </p>
                        )}
                      </div>
                      <input type="hidden" {...register(`items.${index}.partId`)} />
                    </div>

                    <div className="col-span-12 flex items-end gap-2 sm:contents">
                      <div className="flex-1 sm:col-span-3">
                        <Input
                          type="number"
                          min="1"
                          onFocus={selectOnFocus}
                          {...register(`items.${index}.quantity`)}
                          error={errors.items?.[index]?.quantity?.message}
                        />
                      </div>
                      <div className="shrink-0 sm:col-span-1 sm:flex sm:justify-end">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
