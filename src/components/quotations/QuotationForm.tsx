"use client"

import { useEffect, useMemo } from "react"
import Image from "next/image"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { ImageOff, Trash2 } from "lucide-react"
import { QuotationSchema, type QuotationInput } from "@/lib/schemas"
import { createQuotation, updateQuotation } from "@/lib/actions/quotations"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { formatCurrency } from "@/lib/utils"
import { DEFAULT_VAT_PERCENT } from "@/lib/constants"
import { SERVICE_TYPE_LABELS, EQUIPMENT_TYPE_LABELS } from "@/types"
import type { EquipmentType, ServiceType } from "@/types"
import type { SparePartOption } from "@/lib/data/inventory"
import { StockItemSearch } from "./StockItemSearch"

const ALL_SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]

interface CustomerOption {
  id: string
  name: string | null
  code: string
  companyName: string
  pinNumber: string | null
  branches: { id: string; name: string }[]
}

interface EquipmentOption {
  id: string
  brand: string
  model: string
  serialNumber: string
  type: EquipmentType
  customerId: string
}

interface QuotationFormProps {
  customers: CustomerOption[]
  allEquipment: EquipmentOption[]
  spareParts: SparePartOption[]
  defaultValues?: Partial<QuotationInput>
  quotationId?: string
}

export function QuotationForm({
  customers,
  allEquipment,
  spareParts,
  defaultValues,
  quotationId,
}: QuotationFormProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(quotationId)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<QuotationInput>({
    resolver: zodResolver(QuotationSchema) as Resolver<QuotationInput>,
    defaultValues: {
      serviceType: "REPAIR",
      vatPercent: DEFAULT_VAT_PERCENT,
      items: [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  const selectedCustomerId = watch("customerId")
  const watchedItems = watch("items")
  const vatPercent = Number(watch("vatPercent")) || 0

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
  const branches = selectedCustomer?.branches ?? []

  const partsById = useMemo(() => new Map(spareParts.map((p) => [p.id, p])), [spareParts])

  const customerEquipment = useMemo(
    () => allEquipment.filter((e) => e.customerId === selectedCustomerId),
    [allEquipment, selectedCustomerId]
  )

  useEffect(() => {
    if (!isEdit) {
      setValue("equipmentId", "")
      setValue("branchId", "")
    }
  }, [selectedCustomerId, setValue, isEdit])

  const subtotal = (watchedItems ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  )
  const vatAmount = (subtotal * vatPercent) / 100
  const total = subtotal + vatAmount

  function addStockItem(part: SparePartOption) {
    append({ partId: part.id, quantity: 1, unitPrice: Number(part.sellingPrice) })
  }

  async function onSubmit(data: QuotationInput) {
    const result = isEdit
      ? await updateQuotation(quotationId!, data)
      : await createQuotation(data)
    if (result?.error) {
      toast.error(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-5">

        {/* Customer + Branch */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Customer" htmlFor="customerId" required error={errors.customerId?.message}>
              <Select
                id="customerId"
                placeholder="Select customer…"
                {...register("customerId")}
                error={errors.customerId?.message}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}{c.name ? ` — ${c.name}` : ""} ({c.code})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Branch / Site" htmlFor="branchId" error={errors.branchId?.message}>
              <Select
                id="branchId"
                placeholder="None (main location)"
                {...register("branchId")}
                disabled={!selectedCustomerId || branches.length === 0}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          {/* Auto-filled from selected customer */}
          {selectedCustomer && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 rounded-lg bg-slate-50 p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">{t("companyName")}</p>
                <p className="text-sm font-medium text-slate-900">{selectedCustomer.companyName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">{t("pinNumber")}</p>
                <p className="text-sm font-medium text-slate-900">{selectedCustomer.pinNumber || "—"}</p>
              </div>
            </div>
          )}

          {/* Equipment (optional for quotation) */}
          <FormField label="Equipment" htmlFor="equipmentId" error={errors.equipmentId?.message}>
            <Select
              id="equipmentId"
              placeholder={selectedCustomerId ? "Select equipment (optional)…" : "Select a customer first"}
              {...register("equipmentId")}
              disabled={!selectedCustomerId}
            >
              {customerEquipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {EQUIPMENT_TYPE_LABELS[e.type]} — {e.brand} {e.model} ({e.serialNumber})
                </option>
              ))}
            </Select>
            {selectedCustomerId && customerEquipment.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">No equipment registered for this customer.</p>
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Service Type" htmlFor="serviceType" required error={errors.serviceType?.message}>
              <Select id="serviceType" {...register("serviceType")} error={errors.serviceType?.message}>
                {ALL_SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>{SERVICE_TYPE_LABELS[st]}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Valid Until" htmlFor="validUntil" error={errors.validUntil?.message}>
              <Input id="validUntil" type="date" {...register("validUntil")} />
            </FormField>
          </div>

          <FormField label="Problem Description" htmlFor="problemDesc" required error={errors.problemDesc?.message}>
            <Textarea
              id="problemDesc"
              rows={3}
              placeholder="Describe the fault or service scope…"
              {...register("problemDesc")}
              error={errors.problemDesc?.message}
            />
          </FormField>
        </div>

        {/* Stock Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Quotation Items</h2>

          <StockItemSearch spareParts={spareParts} onSelect={addStockItem} />

          {errors.items?.message && (
            <p className="text-xs text-red-600">{errors.items.message}</p>
          )}

          {fields.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">No items added yet. Search for a stock item above to add it.</p>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 pb-1 border-b border-slate-100">
                <div className="col-span-5">Item</div>
                <div className="col-span-2 text-right">Quantity</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-1" />
              </div>
              {fields.map((field, index) => {
                const itemPartId = watchedItems?.[index]?.partId
                const part = itemPartId ? partsById.get(itemPartId) : undefined
                const qty = Number(watchedItems?.[index]?.quantity) || 0
                const price = Number(watchedItems?.[index]?.unitPrice) || 0
                const amount = qty * price
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-5 flex items-center gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {part?.imageUrl ? (
                          <Image src={part.imageUrl} alt={part.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          <ImageOff className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {part ? (part.brand ? `${part.brand} — ${part.name}` : part.name) : "Unknown item"}
                        </p>
                        {part && <p className="text-xs text-slate-400 font-mono">{part.partNumber}</p>}
                      </div>
                      <input type="hidden" {...register(`items.${index}.partId`)} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        {...register(`items.${index}.quantity`)}
                        error={errors.items?.[index]?.quantity?.message}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...register(`items.${index}.unitPrice`)}
                        error={errors.items?.[index]?.unitPrice?.message}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-2 text-right text-sm text-slate-600 font-medium">
                      {formatCurrency(amount)}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Cost Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-5">Cost Summary</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={`${t("vat")} (%)`} htmlFor="vatPercent" error={errors.vatPercent?.message}>
              <Input id="vatPercent" type="number" min="0" max="100" step="0.01" placeholder="0.00" {...register("vatPercent")} />
            </FormField>
          </div>

          {/* Live total */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {vatPercent > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{t("vat")} ({vatPercent}%)</span>
                  <span>{formatCurrency(vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2 mt-1">
                <span>{t("total")}</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Remarks + Notes */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Additional Information</h2>
          <FormField label="Remarks (customer-facing)" htmlFor="remarks" error={errors.remarks?.message}>
            <Textarea
              id="remarks"
              rows={2}
              placeholder="e.g. Quotation valid for 30 days. Price excludes site visit charges."
              {...register("remarks")}
            />
          </FormField>
          <FormField label="Internal Notes" htmlFor="internalNotes" error={errors.internalNotes?.message}>
            <Textarea
              id="internalNotes"
              rows={2}
              placeholder="Internal notes not shown to the customer…"
              {...register("internalNotes")}
            />
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
